from flask import Flask, request, jsonify
from runner import run_code
from flask_cors import CORS
from models import User, File
from db import SessionLocal
import bcrypt
import jwt
import datetime
from functools import wraps
import os

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
# ---------------------------
# App Setup
# ---------------------------
app = Flask(__name__)
CORS(app)

SECRET_KEY = "compiler_online"    # 👉 change this later

@app.route("/")
def home():
    return "Backend is running 🚀"
# ---------------------------
# JWT Helpers
# ---------------------------
def create_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except:
        return None


# ---------------------------
# Auth Decorator
# ---------------------------
def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return {"error": "Authorization header missing"}, 401

        try:
            token = auth_header.split(" ")[1]
        except:
            return {"error": "Invalid token format"}, 401

        data = decode_token(token)
        if not data:
            return {"error": "Invalid or expired token"}, 401

        db = SessionLocal()
        user = db.query(User).filter(User.id == data["user_id"]).first()
        db.close()

        if not user:
            return {"error": "User not found"}, 401

        return f(user, *args, **kwargs)

    return wrapper


# ---------------------------
# Code Runner API
# ---------------------------
@app.post("/run")
def run():
    data = request.json
    language = data.get("language")
    code = data.get("code")

    output = run_code(language, code)
    return jsonify({"output": output})


# ---------------------------
# Auth APIs
# ---------------------------
@app.post("/signup")
def signup():
    data = request.json
    email = data["email"]
    password = data["password"]
    name = data["name"]

    db = SessionLocal()

    if db.query(User).filter(User.email == email).first():
        return {"error": "Email already exists"}, 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    new_user = User(email=email, password=hashed, name=name)
    db.add(new_user)
    db.commit()

    token = create_token(new_user.id)

    db.close()
    return {"token": token, "name": name}


@app.post("/login")
def login():
    data = request.json
    email = data["email"]
    password = data["password"]

    db = SessionLocal()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"error": "Invalid credentials"}, 401

    if not bcrypt.checkpw(password.encode(), user.password.encode()):
        return {"error": "Wrong password"}, 401

    token = create_token(user.id)
    db.close()

    return {"token": token, "name": user.name}


# ---------------------------
# File CRUD APIs
# ---------------------------
@app.get("/files")
@auth_required
def get_files(user):
    db = SessionLocal()
    files = db.query(File).filter(File.user_id == user.id).all()
    db.close()

    return [
        {"id": f.id, "filename": f.filename, "content": f.content}
        for f in files
    ]


@app.post("/files")
@auth_required
def create_file(user):
    data = request.json

    db = SessionLocal()
    new_file = File(
        user_id=user.id,
        filename=data["filename"],
        content=data.get("content", "")
    )
    db.add(new_file)
    db.commit()

    file_id = new_file.id
    db.close()

    return {"id": file_id}


@app.put("/files/<int:file_id>")
@auth_required
def update_file(user, file_id):
    data = request.json

    db = SessionLocal()
    file = db.query(File).filter(File.id == file_id, File.user_id == user.id).first()

    if not file:
        return {"error": "File not found"}, 404

    file.filename = data["filename"]
    file.content = data["content"]
    db.commit()
    db.close()

    return {"success": True}


@app.delete("/files/<int:file_id>")
@auth_required
def delete_file(user, file_id):
    db = SessionLocal()
    file = db.query(File).filter(File.id == file_id, File.user_id == user.id).first()

    if not file:
        return {"error": "File not found"}, 404

    db.delete(file)
    db.commit()
    db.close()

    return {"deleted": True}


# ---------------------------
# Start Server
# ---------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
