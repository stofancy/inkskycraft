# 游戏本地字体（P3-09 朱雀仿宋）

正文与共用文字标题使用制作人选定的朱雀仿宋 Regular v0.212，数字继续使用 Noto Serif CJK SC Regular 的原子集、家族与字形。获批题字图片保持现有表现。

- 朱雀官方发布：https://github.com/TrionesType/zhuque/releases/tag/v0.212
- 正文源：`source/ZhuqueFangsong-Regular.ttf`，从官方 `ZhuqueFangsong-v0.212.zip` 提取，与 P2-01 对比字体相同。官方许可：https://github.com/TrionesType/zhuque/blob/005a8d0d620cb1fe2a576620a69daea3cc7477b4/LICENSE.txt ，本地 `Zhuque-OFL.txt`。
- 数字源：`source/NotoSerifCJKsc-Regular.otf`，固定官方提交 `f8d157532fbfaeda587e826d4cd5b21a49186f7c`；官方许可：https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Serif/LICENSE ，本地 `Noto-OFL.txt`。
- 两种字体均为 SIL OFL 1.1，可嵌入软件，随包保留版权与许可；修改子集采用独立家族 `InkskyFangsong` 与 `InkskyNumbers`。生产包含正文 `fonts/OFL.txt` 与数字 `fonts/Noto-OFL.txt`，字体文件不能单独销售。

字体角色是 `--font-title`、`--font-body`、`--font-number`。`tools/fonts/config.json` 的 source/license 配置正文，numericSource/numericLicense 配置数字；两个子集各记录来源哈希。源字体保存在 assets，不进入生产包；public 只包含使用的 WOFF2 与授权文件。

工具准备：`npm run fonts:setup`，fontTools 与 Brotli 安装到项目 `.venv/`。`npm run build` 与 `npm run dev` 自动生成字体；单独生成用 `npm run fonts:subset`。安装完工具后可离线构建、离线运行。

扫描 `src/**/*.ts`、`tools/**/*.ts` 的字符串与模板文本，排除注释、CSS 与生成的 fonts.ts；外部动态文字登记 extraText。汉字缺失阻止构建，特殊符号缺失写入报告。输出正文/数字 WOFF2、授权文件、`src/ui/fonts.ts` 与 `assets/fonts/subset-report.json`，生成文件随分支提交。

缺少 Python、fontTools 或 Brotli 时沿用已提交字体，输出当前源码字集覆盖提示；准备工具后重建。数字不变由 P3-09 的前后 SHA256 比较验证。字体对比记录位于主工作区绝对路径 `local-source/README.md`，交付证据位于 `local-source/P3-09.md`。
