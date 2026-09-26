import os
import re

color_map = {
    '#0284c7': '#2e7d32',
    '#0369a1': '#1b5e20',
    '#38bdf8': '#66bb6a',
    '#7dd3fc': '#81c784',
    '#bae6fd': '#c8e6c9',
    '#0a2038': '#0a2618',
    '#0c2f52': '#0e3520',
    'rgba(2, 132, 199': 'rgba(46, 125, 50',
    'rgba(56, 189, 248': 'rgba(76, 175, 80',
    'rgba(2,132,199': 'rgba(46,125,50',
    'rgba(56,189,248': 'rgba(76,175,80',
    '#06b6d4': '#00897b',
    '#0ea5e9': '#43a047'
}

files_to_check = [
    'g:/swasya-ai-web-v12/frontend/static/index.html',
    'g:/swasya-ai-web-v12/frontend/static/js/app.js',
    'g:/swasya-ai-web-v12/frontend/static/js/patient_kiosk.js',
    'g:/swasya-ai-web-v12/frontend/static/js/admin.js',
    'g:/swasya-ai-web-v12/frontend/static/js/doctor.js',
    'g:/swasya-ai-web-v12/frontend/static/js/nurse.js',
    'g:/swasya-ai-web-v12/frontend/static/js/map.js',
    'g:/swasya-ai-web-v12/frontend/static/js/voice.js'
]

for file_path in files_to_check:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content
        for blue, green in color_map.items():
            new_content = new_content.replace(blue, green)
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated colors in {file_path}")
