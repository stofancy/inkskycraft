# 伙伴素材

三张原创素材通过订阅内置 `image_gen` 独立生成，再用同一工具纠正留白；最终保留主体较大的第二稿，便于72–100逻辑单位下识别。未使用API-key CLI，未抠图或用程序修改图片。全部为1254×1254 RGBA，存在真实alpha=0透明像素。已逐张view_image检查完整轮廓和头朝上。

|文件|造型与用途|可见主体bbox（alpha >=128）|
|---|---|---|
|yaoque.png|曜雀：朱砂扇形火羽、黑漆机械凤凰、金箔关节；攻击协同|(185,215,1070,1055)|
|qingli.png|青璃：青玉长鲤、流动墨鳍、少量旧铜；守护与回墨|(287,187,967,1141)|
|moyuan.png|墨鸢：纸白折纸鸢/龙、紫金墨线、悬浮空白符片；控场与封印|(169,176,1085,1104)|

安全边界：可见主体约9–17%留白；极低alpha碎像素在更外侧。主会话已接受此稿。第三稿缩小试验留在工具默认generated_images目录，未替换游戏素材。

最终prompt要点：原创纵版STG伙伴；正交俯视、头朝上、轮廓完整居中；高级水墨手绘与雕塑式机械厚度、微磨损和局部光；三种独立剪影；真透明；避免卡通眼睛、圆滚可爱、白泛光、背景、文字、标志与现成IP。

# 角色设计规则与一手参考

- [Returnal开发者敌人设计](https://blog.playstation.com/2021/04/14/creating-returnals-otherworldly-enemies-vfx-driven-tentacle-tech-and-deep-sea-inspirations/)：发光位置同时承担预告与命中反应，敌人按追击/远射等职责组合。迁移为外形和行为一一对应：扇形攻、流线守、锐角控；局部裂纹与能量线承担状态信号。
- [Guerrilla机械造型](https://blog.playstation.com/2017/02/24/the-making-of-horizon-zero-dawns-machines/)：弱点数量与分布形成不同处理策略。迁移为关节、护板和核心的明确层级，毁伤后真实改变轮廓与能力。
- [Horus开发回顾](https://blog.playstation.com/2024/05/13/horizon-forbidden-west-burning-shores-expansion-turns-one-building-the-massive-horus-battle/)：让玩家有机会观察全身与环境破坏，伙伴制造攻击窗口。迁移为变形前短暂拉开位置，在当前画面中展示整体体态变化与场景后果。
- [SOL CRESTA官方](https://www.platinumgames.com/works/sol-cresta)：相对编队位置改变攻击性质。迁移为伙伴协同有具体战术用途，分别打开破甲窗口、保护移动路线、固定控场节点。

未来中式武侠机械造型取舍：选择器物材质、榫接逻辑、扇面/鳞片/折纸结构作为形态语言；在大形上先表达功能，少量金属节点交代驱动关系。暂不添加服装、文字符咒、复杂脸部和密集装饰，防止缩小后识别成本上升。敌我都应有自己的大形语法，配色作辅助；主角中轴稳定、伙伴轮廓分工明显，敌人危险部位优先由张合角度、蓄势动作和局部能量预告表达。
