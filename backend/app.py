from flask import Flask, request, jsonify
from runner import run_code
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/run", methods=["POST"])
def run():
    data = request.json
    language = data.get("language")
    code = data.get("code")

    output = run_code(language, code)
    return jsonify({"output": output})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
