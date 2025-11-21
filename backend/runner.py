import subprocess
import tempfile
import os

def run_code(language, code):
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = ""

        if language == "python":
            file_path = os.path.join(temp_dir, "main.py")
            with open(file_path, "w") as f:
                f.write(code)
            command = ["python", file_path]

        elif language == "javascript":
            file_path = os.path.join(temp_dir, "main.js")
            with open(file_path, "w") as f:
                f.write(code)
            command = ["node", file_path]

        elif language == "c":
            file_path = os.path.join(temp_dir, "main.c")
            exe = os.path.join(temp_dir, "a.out")
            with open(file_path, "w") as f:
                f.write(code)
            subprocess.run(["gcc", file_path, "-o", exe])
            command = [exe]

        elif language == "cpp":
            file_path = os.path.join(temp_dir, "main.cpp")
            exe = os.path.join(temp_dir, "a.out")
            with open(file_path, "w") as f:
                f.write(code)
            subprocess.run(["g++", file_path, "-o", exe])
            command = [exe]

        elif language == "java":
            file_path = os.path.join(temp_dir, "Main.java")
            with open(file_path, "w") as f:
                f.write(code)

            # Compile
            compile_proc = subprocess.run(
                ["javac", file_path],
                capture_output=True,
                text=True
            )

            if compile_proc.stderr:
                return compile_proc.stderr

            # Run class
            run_proc = subprocess.run(
                ["java", "-cp", temp_dir, "Main"],
                capture_output=True,
                text=True
            )

            return run_proc.stdout + run_proc.stderr

        else:
            return "Unsupported language"

        # For non-java languages
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=5)
            return result.stdout if result.stdout else result.stderr
        except subprocess.TimeoutExpired:
            return "⏳ Execution Timeout"
        except Exception as e:
            return str(e)
