import re
text = "A\x0cB"
parts = re.split(r"\f", text)
print("Raw r'\\f':", repr(parts))

parts2 = re.split("\f", text)
print("Normal '\\f':", repr(parts2))

text2 = "A\\fB"
parts3 = re.split(r"\\f", text2)
print("Literal backslash-f:", repr(parts3))
