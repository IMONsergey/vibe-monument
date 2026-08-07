use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, hash_map::DefaultHasher};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;

const MAX_TREE_DEPTH: usize = 5;
const MAX_TREE_ENTRIES: usize = 600;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    name: String,
    path: String,
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileNode>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSnapshot {
    repository_root: Option<String>,
    branch: Option<String>,
    remote: Option<String>,
    changed_files: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInspection {
    id: String,
    name: String,
    root_path: String,
    package_manager: Option<String>,
    framework: Option<String>,
    scripts: BTreeMap<String, String>,
    suggested_dev_command: Option<String>,
    git: GitSnapshot,
    files: Vec<FileNode>,
}

fn stable_id(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    format!("project-{:x}", hasher.finish())
}

fn read_package_json(root: &Path) -> Option<Value> {
    let content = fs::read_to_string(root.join("package.json")).ok()?;
    serde_json::from_str(&content).ok()
}

fn scripts_from_package(package: Option<&Value>) -> BTreeMap<String, String> {
    package
        .and_then(|value| value.get("scripts"))
        .and_then(Value::as_object)
        .map(|scripts| {
            scripts
                .iter()
                .filter_map(|(key, value)| value.as_str().map(|command| (key.clone(), command.to_string())))
                .collect()
        })
        .unwrap_or_default()
}

fn package_has(package: Option<&Value>, dependency: &str) -> bool {
    let Some(package) = package else { return false; };
    ["dependencies", "devDependencies", "peerDependencies"]
        .iter()
        .filter_map(|key| package.get(*key).and_then(Value::as_object))
        .any(|deps| deps.contains_key(dependency))
}

fn detect_framework(root: &Path, package: Option<&Value>) -> Option<String> {
    if root.join("next.config.js").exists() || root.join("next.config.mjs").exists() || root.join("next.config.ts").exists() || package_has(package, "next") {
        return Some("Next.js".into());
    }
    if root.join("astro.config.mjs").exists() || root.join("astro.config.ts").exists() || package_has(package, "astro") {
        return Some("Astro".into());
    }
    if root.join("nuxt.config.ts").exists() || root.join("nuxt.config.js").exists() || package_has(package, "nuxt") {
        return Some("Nuxt".into());
    }
    if root.join("vite.config.ts").exists() || root.join("vite.config.js").exists() || root.join("vite.config.mjs").exists() || package_has(package, "vite") {
        if package_has(package, "react") { return Some("Vite + React".into()); }
        if package_has(package, "vue") { return Some("Vite + Vue".into()); }
        return Some("Vite".into());
    }
    if package_has(package, "react") { return Some("React".into()); }
    if package_has(package, "vue") { return Some("Vue".into()); }
    if package_has(package, "svelte") { return Some("Svelte".into()); }
    None
}

fn detect_package_manager(root: &Path) -> Option<String> {
    if root.join("pnpm-lock.yaml").exists() { return Some("pnpm".into()); }
    if root.join("bun.lockb").exists() || root.join("bun.lock").exists() { return Some("bun".into()); }
    if root.join("yarn.lock").exists() { return Some("yarn".into()); }
    if root.join("package-lock.json").exists() { return Some("npm".into()); }
    root.join("package.json").exists().then(|| "npm".into())
}

fn suggested_dev_command(package_manager: Option<&str>, scripts: &BTreeMap<String, String>) -> Option<String> {
    let script = if scripts.contains_key("dev") { "dev" } else if scripts.contains_key("start") { "start" } else { return None; };
    let pm = package_manager.unwrap_or("npm");
    Some(match (pm, script) {
        ("npm", "start") => "npm start".into(),
        ("npm", _) => format!("npm run {script}"),
        (_, _) => format!("{pm} {script}"),
    })
}

fn git_output(root: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git").args(args).current_dir(root).output().ok()?;
    if !output.status.success() { return None; }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn inspect_git(root: &Path) -> GitSnapshot {
    let repository_root = git_output(root, &["rev-parse", "--show-toplevel"]).filter(|value| !value.is_empty());
    let command_root = repository_root.as_deref().map(Path::new).unwrap_or(root);
    let branch = git_output(command_root, &["branch", "--show-current"]).filter(|value| !value.is_empty());
    let remote = git_output(command_root, &["remote", "get-url", "origin"]).filter(|value| !value.is_empty());
    let changed_files = git_output(command_root, &["status", "--porcelain=v1", "--untracked-files=all"])
        .map(|value| value.lines().filter(|line| !line.trim().is_empty()).count())
        .unwrap_or(0);
    GitSnapshot { repository_root, branch, remote, changed_files }
}

fn should_hide(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt" | "coverage" | ".DS_Store")
        || name == ".env"
        || name.starts_with(".env.")
}

fn build_tree(root: &Path, directory: &Path, depth: usize, count: &mut usize) -> Vec<FileNode> {
    if depth > MAX_TREE_DEPTH || *count >= MAX_TREE_ENTRIES { return Vec::new(); }
    let Ok(read_dir) = fs::read_dir(directory) else { return Vec::new(); };
    let mut entries: Vec<PathBuf> = read_dir.filter_map(Result::ok).map(|entry| entry.path()).collect();
    entries.sort_by(|a, b| {
        let ad = a.is_dir();
        let bd = b.is_dir();
        bd.cmp(&ad).then_with(|| a.file_name().cmp(&b.file_name()))
    });

    let mut nodes = Vec::new();
    for path in entries {
        if *count >= MAX_TREE_ENTRIES { break; }
        let name = path.file_name().map(|value| value.to_string_lossy().to_string()).unwrap_or_default();
        if should_hide(&name) { continue; }
        *count += 1;
        let relative = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().to_string();
        if path.is_dir() {
            let children = build_tree(root, &path, depth + 1, count);
            nodes.push(FileNode { name, path: relative, kind: "directory".into(), children: Some(children) });
        } else {
            nodes.push(FileNode { name, path: relative, kind: "file".into(), children: None });
        }
    }
    nodes
}

fn inspect_path(path: PathBuf) -> Result<ProjectInspection, String> {
    let root = path.canonicalize().map_err(|error| format!("Cannot open project path: {error}"))?;
    if !root.is_dir() { return Err("Selected project is not a directory".into()); }
    let package = read_package_json(&root);
    let scripts = scripts_from_package(package.as_ref());
    let package_manager = detect_package_manager(&root);
    let framework = detect_framework(&root, package.as_ref());
    let suggested_dev_command = suggested_dev_command(package_manager.as_deref(), &scripts);
    let git = inspect_git(&root);
    let mut count = 0;
    let files = build_tree(&root, &root, 0, &mut count);
    let name = root.file_name().map(|value| value.to_string_lossy().to_string()).unwrap_or_else(|| "Project".into());

    Ok(ProjectInspection {
        id: stable_id(&root),
        name,
        root_path: root.to_string_lossy().to_string(),
        package_manager,
        framework,
        scripts,
        suggested_dev_command,
        git,
        files,
    })
}

#[tauri::command]
pub fn project_open() -> Result<Option<ProjectInspection>, String> {
    match rfd::FileDialog::new().set_title("Open project in Monument").pick_folder() {
        Some(path) => inspect_path(path).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn project_inspect(path: String) -> Result<ProjectInspection, String> {
    inspect_path(PathBuf::from(path))
}
