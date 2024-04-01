const fs = require('fs');
const path = require('path');
const pc  = require('picocolors');

// 获取命令行参数
const args = process.argv.slice(2);

if (args.length !== 1) {
    console.log(
        pc.red('[ERROR] ===== please give me a filename ^_^ =====')
    )
    process.exit(1);
}

const filename = args[0];
const currentDate = new Date();
const formattedDate = currentDate.toISOString().slice(0, 10); // 格式化日期为 YYYY-MM-DD

const postsDirectory = path.join(process.cwd(), '_posts'); // 获取当前工作目录并拼接 _posts 文件夹路径
const markdownFilename = path.join(postsDirectory, `${formattedDate}-${filename}.md`);

// 创建Markdown文件
fs.writeFile(markdownFilename, '', (err) => {
    if (err) {
        console.error('Error creating Markdown file:', err);
    } else {
        console.log(`Markdown file "${markdownFilename}" created successfully.`);
    }
});
