# Into the Wild 伴读网页

在本文件夹中启动任意本地静态服务器，再打开 `index.html`。例如安装了 Python 时：

```powershell
python -m http.server 8080
```

浏览器访问 `http://localhost:8080`。点击英文单词或拖选英文短语，右侧面板会显示释义；面板可关闭，原文宽度不会被它改变。章节目录、翻页、深色模式和阅读进度均可用。

`book.json` 由你提供的 PDF 提取而成，只在本地阅读器中使用。若更换 PDF，可执行：

```powershell
$env:PYTHONPATH='..\\tmp\\into_wild\\deps'; python .\\extract_book.py 'PDF完整路径' .\\book.json
```
