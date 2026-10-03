// 第一章台词：local-source/lines.md 第四稿，按表内顺序。
import type { Line } from './dialogue1';
export const BOSS_LINES:Line[]=[
 {"id":"CH1.B03.01","trigger":"B-5.1-聚形完成","speaker":"雷公","emotion":"calm","text":"拆了我的网，还打伤我的人。朱雀镖局？好，那就让你们见识见识我的纸龙。","memory":false,"pause":true},
 {"id":"CH1.B03.05","trigger":"B-5.1-聚形完成","speaker":"小满","emotion":"alarmed","text":"好大一条龙！师姐，你护住云梭左边，我守右边！","memory":false,"pause":true},
 {"id":"CH1.B03.06","trigger":"B-5.1-聚形完成","speaker":"赤燕","emotion":"calm","text":"知道了，你自己也小心！","memory":false,"pause":true},
 {"id":"CH1.BARK.B.07","trigger":"B-5.4-第一次扣船","speaker":"小满","emotion":"alarmed","text":"龙爪抓住云梭了！快放开！","memory":false,"pause":false},
 {"id":"CH1.BARK.B.11","trigger":"B-5.5-纸甲落尽","speaker":"雷公","emotion":"calm","text":"哼，有点本事。","memory":false,"pause":false},
 {"id":"CH1.B05.03","trigger":"B-5.7-封成功 2s 后","speaker":"雷公","emotion":"calm","text":"算你们走运。不过前面就是铜雀关，过关要交三两雷石，你们交得起吗？","memory":false,"pause":true},
 {"id":"CH1.B05.05","trigger":"B-5.7-封成功 2s 后","speaker":"小满","emotion":"calm","text":"总算把它打下来了……师姐，铜雀关是什么地方？","memory":false,"pause":true},
 {"id":"CH1.B05.07","trigger":"B-5.7-封成功 2s 后","speaker":"赤燕","emotion":"calm","text":"去天门必经的关口，有只铜雀守着，过关要交雷石。三两雷石，咱们可拿不出来。","memory":false,"pause":true},
 {"id":"CH1.B05.08","trigger":"B-5.7-封成功 2s 后","speaker":"小满","emotion":"smug","text":"到了再说吧，总会有办法的。","memory":false,"pause":true},
 {"id":"CH1.B07.01","trigger":"B-4.1-铜雀展翼挡口","speaker":"铜雀","emotion":"calm","text":"前方船只请停下。过铜雀关，每艘船需交雷石三两。交不出的，请原路返回。","memory":false,"pause":true,"identity":"守关机"},
 {"id":"CH1.B07.04","trigger":"B-4.1-铜雀展翼挡口","speaker":"小满","emotion":"alarmed","text":"我们交不起啊！青石屿都快沉了，我们还能回哪儿去！","memory":false,"pause":true},
 {"id":"CH1.B07.03","trigger":"B-4.1-铜雀展翼挡口","speaker":"铜雀","emotion":"calm","text":"交不出的，请原路返回。","memory":false,"pause":true},
 {"id":"CH1.B07.06","trigger":"B-4.1-铜雀展翼挡口","speaker":"赤燕","emotion":"calm","text":"跟一台机器讲不了道理。小满，硬闯吧，我帮你。","memory":false,"pause":true},
 {"id":"CH1.B07.08","trigger":"B-4.1-铜雀展翼挡口","speaker":"小满","emotion":"smug","text":"好！云梭，跟紧我！","memory":false,"pause":true},
 {"id":"CH1.B07.09","trigger":"B-4.1-铜雀展翼挡口","speaker":"铜雀","emotion":"alarmed","text":"拒不缴费，按闯关处理。","memory":false,"pause":true},
 {"id":"CH1.B08.07","trigger":"B-4.2-T1 HP≤20%","speaker":"赤燕","emotion":"calm","text":"它快不行了，再加把劲！","memory":false,"pause":false},
 {"id":"CH1.B08.17","trigger":"B-4.3-转场","speaker":"铜雀","emotion":"calm","text":"翼炮损坏，切换攻击方式。","memory":false,"pause":false},
 {"id":"CH1.B08.36","trigger":"B-4.6-协助分支","speaker":"赤燕","emotion":"smug","text":"小满，让开，我来！","memory":false,"pause":false},
 {"id":"CH1.B08.38","trigger":"B-4.6-封成功","speaker":"铜雀","emotion":"calm","text":"系统停止运行……关卡开放。","memory":false,"pause":false},
];
export const BOSS_DIALOGUE_BY_ID:Record<string,Line>=Object.fromEntries(BOSS_LINES.map(l=>[l.id,l]));
