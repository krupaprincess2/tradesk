# 🐍 Python Concepts Used in TradDesk Backend
# Read this alongside main.py to understand what each part does!

# ─────────────────────────────────────────────
# 1. FUNCTIONS — def keyword
# ─────────────────────────────────────────────
def say_hello(name):           # Define a function
    return f"Hello, {name}!"   # f-string for string formatting

result = say_hello("Krupa")    # Call the function
print(result)                  # Output: Hello, Krupa!


# ─────────────────────────────────────────────
# 2. DICTIONARIES — like JSON objects
# ─────────────────────────────────────────────
user = {
    "name": "Krupa",
    "email": "krupa@example.com",
    "age": 25
}

print(user["name"])            # Output: Krupa
user["city"] = "Hyderabad"     # Add new key
print(user)


# ─────────────────────────────────────────────
# 3. LISTS — like arrays
# ─────────────────────────────────────────────
purchases = [
    {"item": "Cotton", "qty": 100},
    {"item": "Thread", "qty": 50},
]

for purchase in purchases:     # Loop through list
    print(purchase["item"])    # Output: Cotton, Thread


# ─────────────────────────────────────────────
# 4. IF / ELSE — conditions
# ─────────────────────────────────────────────
profit = 5000

if profit > 0:
    print("You made a profit!")
elif profit == 0:
    print("Break even")
else:
    print("You made a loss")


# ─────────────────────────────────────────────
# 5. CLASSES (Pydantic Models) — data validation
# ─────────────────────────────────────────────
# In main.py we use Pydantic BaseModel like this:
# class PurchaseCreate(BaseModel):
#     date: str
#     supplier: str
#     qty: float
#
# This automatically validates incoming data!
# If someone sends qty as "hello" instead of a number,
# FastAPI returns an error automatically.


# ─────────────────────────────────────────────
# 6. OPTIONAL — when a field is not required
# ─────────────────────────────────────────────
from typing import Optional

def greet(name: str, title: Optional[str] = None):
    if title:
        return f"Hello, {title} {name}!"
    return f"Hello, {name}!"

print(greet("Krupa"))              # Hello, Krupa!
print(greet("Krupa", "Ms."))      # Hello, Ms. Krupa!


# ─────────────────────────────────────────────
# 7. SQLITE — database operations
# ─────────────────────────────────────────────
import sqlite3

# Connect to database
conn = sqlite3.connect("example.db")

# Execute SQL query
conn.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)")
conn.execute("INSERT INTO items (name) VALUES (?)", ("Cotton",))
conn.commit()

# Read data
rows = conn.execute("SELECT * FROM items").fetchall()
for row in rows:
    print(row)

conn.close()


# ─────────────────────────────────────────────
# 8. DECORATORS — the @ symbol
# ─────────────────────────────────────────────
# In FastAPI, decorators define API routes:
#
# @app.get("/api/purchases")    ← This is a decorator
# def list_purchases():          ← This is the function
#     return [...]
#
# @app.get means: "when someone visits /api/purchases with GET method, run this function"
# @app.post means: "when someone sends data to this URL, run this function"


# ─────────────────────────────────────────────
# 9. ENVIRONMENT VARIABLES
# ─────────────────────────────────────────────
import os

# Read a secret from the environment (not hardcoded in code!)
secret = os.getenv("JWT_SECRET", "default_if_not_set")
print(secret)

# In Railway, you set JWT_SECRET in the Variables tab
# In your code, os.getenv() reads it safely


# ─────────────────────────────────────────────
# 10. LIST COMPREHENSIONS — powerful Python shortcut
# ─────────────────────────────────────────────
# Regular way:
result = []
for row in rows:
    result.append(dict(row))

# Python shortcut (same thing!):
result = [dict(row) for row in rows]

# In main.py we use this to convert database rows to dicts:
# return [dict(row) for row in rows]
