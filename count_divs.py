import re

file_path = r'c:\Users\admin\Documents\GitHub\yen-recruitment-agent\web\src\components\dashboard\HRDashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("{/* VIEW 2: UPLOAD JD SECTION & ORCHESTRATOR */}")
end_idx = content.find("{/* VIEW 3: CANDIDATES RESUME PAGE */}")

upload_block = content[start_idx:end_idx]

div_opens = len(re.findall(r'<div', upload_block))
div_closes = len(re.findall(r'</div', upload_block))

print(f"div tags - open: {div_opens}, close: {div_closes}")

import html.parser
class JSXValidator(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        
    def handle_starttag(self, tag, attrs):
        if tag.lower() not in ['img', 'input', 'br', 'hr', 'path', 'circle']:
            self.stack.append(tag)
            
    def handle_endtag(self, tag):
        if not self.stack:
            print(f"Error: unexpected closing tag </{tag}>")
            return
        if self.stack[-1] == tag:
            self.stack.pop()
        else:
            print(f"Error: expected </{self.stack[-1]}>, but got </{tag}>")
            self.stack.pop()

validator = JSXValidator()
# Strip { and } expressions to avoid confusing the parser
stripped = re.sub(r'\{[^}]*\}', '', upload_block)
validator.feed(stripped)
print("Remaining tags in stack:", validator.stack)

