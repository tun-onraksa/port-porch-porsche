"""Assemble src/ into index.html.

index.html is a standalone page (open it directly or serve it with GitHub Pages).
Three.js r128 and its OrbitControls load from public CDNs, so it needs a network connection.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


body = (read('style.css') + read('body.html')
        + '<script>\n' + read('terminal49.js') + '\n</script>\n'
        + '<script>\n' + read('sim.js') + '\n</script>\n'
        + '<script>\n' + read('cargo-models.js') + '\n</script>\n'
        + '<script>\n' + read('scene.js') + '\n</script>\n'
        + '<script>\n' + read('game.js') + '\n</script>\n'
        + '<script>\n' + read('operations.js') + '\n</script>\n'
        + '<script>\n' + read('workspace.js') + '\n</script>\n'
        + '<script>\n' + read('orders.js') + '\n</script>\n'
        + '<script>\n' + read('orchestration.js') + '\n</script>\n'
        + '<script>\n' + read('inspection.js') + '\n</script>\n'
        + '<script>\n' + read('projection.js') + '\n</script>\n'
        + '<script>\n' + read('conflict-scene.js') + '\n</script>\n')
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + read('head.html')
        + '<style>[hidden]{display:none!important}body{margin:0}</style>\n'
        '</head>\n<body>\n' + body + '</body>\n</html>\n')

with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(page)
print('wrote index.html', len(page), 'bytes')
