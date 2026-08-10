import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

with open('admin_screen.tsx', 'r') as f:
    admin_screen = f.read()

# Assuming AdminScreen goes until the next function definition or end of file
# It goes until HomeScreen in the previous output? Wait, no. Let's see what is after AdminScreen.
