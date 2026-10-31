import os
import re

files = [
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\risk-planning-identify.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\settings.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\risk-monitoring.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\risk-mitigation.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\risk-identification.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\monitoring.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\risk-assessment.tsx',
    r'c:\Users\Srivatsan\Downloads\b_sb8X5RH5PYe-1773567344670\components\pages\risk-assessments-dashboard.tsx'
]

replacements = {
    'emerald': 'blue',
    'indigo': 'blue',
    'slate': 'blue',
    'zinc': 'blue',
    'gray': 'blue',
    'stone': 'blue',
    'neutral': 'blue',
    'amber': 'blue',
    'orange': 'blue',
    'red-500': 'blue-400',
    'red-600': 'blue-500',
    'red-400': 'blue-300',
    'bg-destructive': 'bg-blue-300',
    'text-destructive': 'text-blue-400'
}

for f in files:
    if os.path.exists(f):
        print(f"Processing {f}...")
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        new_content = content
        for old, new in replacements.items():
            new_content = new_content.replace(old, new)
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f"Finished {f}")
    else:
        print(f"File not found: {f}")
