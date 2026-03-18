import re, os, glob

base = "C:/Users/mithu/OneDrive/Desktop/Projects/TALENTFLOW/apps/web/src"
files = glob.glob(f"{base}/**/*.tsx", recursive=True) + glob.glob(f"{base}/**/*.ts", recursive=True)

# Pattern 1: multi-line destructure with separate "const token = session?.access_token;" line
pattern_multiline_with_token = re.compile(
    r'const \{\s*\n[ \t]*data: \{ session \},\s*\n[ \t]*\} = \(\{ data: \{ session: \{ access_token: awsAuth\.getToken\(\) \} \} \}\);\s*\n[ \t]*const token = session\?\.access_token;',
    re.MULTILINE
)

# Pattern 2: multi-line destructure WITHOUT separate const token line
pattern_multiline_no_token = re.compile(
    r'const \{\s*\n[ \t]*data: \{ session \},\s*\n[ \t]*\} = \(\{ data: \{ session: \{ access_token: awsAuth\.getToken\(\) \} \} \}\);',
    re.MULTILINE
)

# Pattern 3: single-line destructure
pattern_single = re.compile(
    r'const \{ data: \{ session \} \} = \(\{ data: \{ session: \{ access_token: awsAuth\.getToken\(\) \} \} \}\);',
)

total_fixed = 0
for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'awsAuth.getToken()' not in content or 'data: { session' not in content:
        continue
    
    original = content
    
    # Determine the indentation to use for the replacement
    def replace_with_indent(m):
        # Find indentation from the match start
        start = m.start()
        line_start = content.rfind('\n', 0, start) + 1
        indent = ''
        for ch in content[line_start:start]:
            if ch in (' ', '\t'):
                indent += ch
            else:
                break
        # Use same indent as "const {"
        return f'const token = awsAuth.getToken();'
    
    # Fix pattern 1
    content = pattern_multiline_with_token.sub('const token = awsAuth.getToken();', content)
    # Fix pattern 2
    content = pattern_multiline_no_token.sub('const token = awsAuth.getToken();', content)
    # Fix pattern 3
    content = pattern_single.sub('const token = awsAuth.getToken();', content)
    
    # After fixing destructure, replace remaining session.access_token usages with token
    content = re.sub(r'session\?\.access_token', 'token', content)
    content = re.sub(r'session\.access_token', 'token', content)
    
    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        rel = fpath.replace(base.replace('/', os.sep), '').lstrip(os.sep)
        print(f"FIXED: {rel}")
        total_fixed += 1

print(f"\nTotal files fixed: {total_fixed}")
