#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_root() -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "monument-shadow-index-contract-{}-{stamp}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    root
}

fn git() -> Option<PathBuf> {
    for candidate in ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"] {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

fn run(git: &Path, cwd: &Path, args: &[&str]) {
    let output = Command::new(git).args(args).current_dir(cwd).output().unwrap();
    assert!(
        output.status.success(),
        "git {:?} failed: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn shadow_git_index_isolated_from_users_repository_index() {
    let Some(git) = git() else { return; };
    let root = temp_root();
    let project = root.join("project");
    let shadow = root.join("shadow.git");
    let shadow_index = root.join("shadow.index");
    fs::create_dir_all(&project).unwrap();

    run(&git, &project, &["init"]);
    fs::write(project.join("staged.txt"), "staged-v1\n").unwrap();
    fs::write(project.join("timeline.txt"), "timeline-v1\n").unwrap();
    run(&git, &project, &["add", "staged.txt"]);

    let user_index = project.join(".git/index");
    let before = fs::read(&user_index).unwrap();

    let init = Command::new(&git)
        .args(["init", "--bare"])
        .arg(&shadow)
        .output()
        .unwrap();
    assert!(init.status.success());

    let mut read_tree = Command::new(&git);
    read_tree
        .env("GIT_DIR", &shadow)
        .env("GIT_WORK_TREE", &project)
        .env("GIT_INDEX_FILE", &shadow_index)
        .args(["read-tree", "--empty"]);
    assert!(read_tree.output().unwrap().status.success());

    let mut add = Command::new(&git);
    add.env("GIT_DIR", &shadow)
        .env("GIT_WORK_TREE", &project)
        .env("GIT_INDEX_FILE", &shadow_index)
        .args(["add", "-f", "timeline.txt"]);
    assert!(add.output().unwrap().status.success());

    let mut write_tree = Command::new(&git);
    write_tree
        .env("GIT_DIR", &shadow)
        .env("GIT_WORK_TREE", &project)
        .env("GIT_INDEX_FILE", &shadow_index)
        .arg("write-tree");
    assert!(write_tree.output().unwrap().status.success());

    let after = fs::read(&user_index).unwrap();
    assert_eq!(before, after, "Monument shadow history must never rewrite the user's staging index");

    let _ = fs::remove_dir_all(root);
}
