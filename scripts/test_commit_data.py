import os
import subprocess
import tempfile
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "commit_data.sh")
MESSAGE = "chore(test): sync data"


def git(cwd, *args):
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"},
    )
    return result.stdout.strip()


class CommitDataTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name
        self.origin = os.path.join(self.root, "origin.git")
        git(self.root, "init", "--bare", "-b", "main", self.origin)
        self.clone = self.make_clone("seed")
        self.write(self.clone, "data/x.json", "[1]\n")
        git(self.clone, "add", "data/x.json")
        git(self.clone, "commit", "-m", "seed")
        git(self.clone, "push", "origin", "main")
        self.output = os.path.join(self.root, "github_output")

    def make_clone(self, name):
        path = os.path.join(self.root, name)
        git(self.root, "clone", self.origin, path)
        git(path, "checkout", "-B", "main")
        return path

    def write(self, repo, rel, text):
        path = os.path.join(repo, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    def run_script(self, repo, rel):
        return subprocess.run(
            ["bash", SCRIPT, rel, MESSAGE],
            cwd=repo,
            capture_output=True,
            text=True,
            env={**os.environ, "GITHUB_OUTPUT": self.output},
        )

    def origin_main(self):
        return git(self.origin, "rev-parse", "main")

    def output_text(self):
        try:
            with open(self.output, encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            return ""

    def origin_file(self, rel):
        return git(self.origin, "show", f"main:{rel}")

    def test_unchanged_file_exits_0_without_commit(self):
        before = self.origin_main()
        result = self.run_script(self.clone, "data/x.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.origin_main(), before)
        self.assertNotIn("pushed=true", self.output_text())

    def test_changed_file_is_committed_and_pushed(self):
        self.write(self.clone, "data/x.json", "[2]\n")
        result = self.run_script(self.clone, "data/x.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.origin, "log", "-1", "--format=%s", "main"), MESSAGE)
        self.assertEqual(self.origin_file("data/x.json"), "[2]")
        self.assertIn("pushed=true", self.output_text())

    def test_commits_a_new_untracked_file(self):
        self.write(self.clone, "data/new.json", "[3]\n")
        result = self.run_script(self.clone, "data/new.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.origin_file("data/new.json"), "[3]")
        self.assertIn("pushed=true", self.output_text())

    def test_rebases_onto_a_newer_main(self):
        other = self.make_clone("other")
        self.write(other, "other.txt", "hi\n")
        git(other, "add", "other.txt")
        git(other, "commit", "-m", "unrelated")
        git(other, "push", "origin", "main")

        self.write(self.clone, "data/x.json", "[4]\n")
        result = self.run_script(self.clone, "data/x.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.origin, "log", "--format=%s", "-2", "main").splitlines(), [MESSAGE, "unrelated"])
        self.assertEqual(self.origin_file("data/x.json"), "[4]")
        self.assertEqual(self.origin_file("other.txt"), "hi")


if __name__ == "__main__":
    unittest.main()
