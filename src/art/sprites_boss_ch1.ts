// P2-04正式分件：采用已标定的逻辑尺寸、pivot和根轴；左右使用独立PNG。
import type { SpriteDef } from './types';

export const CH1_BOSS_SPRITES: SpriteDef[] = [
  {
    "id": "tq-body",
    "w": 180,
    "h": 210,
    "image": "art/bosses/ch1/tongque/body.png",
    "pivot": [
      0.0,
      3.609
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "wingL": [
        -47.452,
        -32.484
      ],
      "wingR": [
        47.456,
        -32.484
      ],
      "core": [
        0.0,
        0.0
      ],
      "lidL": [
        -26.43,
        0.0
      ],
      "lidR": [
        26.43,
        0.0
      ],
      "tail": [
        0.0,
        -83.918
      ],
      "footL": [
        -22.826,
        55.945
      ],
      "footR": [
        22.826,
        55.945
      ],
      "serviceSocket": [
        0.0,
        59.555
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-beam",
    "w": 160,
    "h": 70,
    "image": "art/bosses/ch1/tongque/wing-beam.png",
    "pivot": [
      -56.375,
      0.887
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "shell": [
        0.0,
        0.0
      ],
      "rootLock": [
        0.0,
        0.0
      ],
      "gunSeat": [
        70.125,
        2.662
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-beam-mirror",
    "w": 160,
    "h": 70,
    "image": "art/bosses/ch1/tongque/wing-beam-mirror.png",
    "pivot": [
      56.375,
      0.887
    ],
    "anchors": {
      "root": [
        -0.0,
        0.0
      ],
      "shell": [
        -0.0,
        0.0
      ],
      "rootLock": [
        -0.0,
        0.0
      ],
      "gunSeat": [
        -70.125,
        2.662
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-shell",
    "w": 220,
    "h": 110,
    "image": "art/bosses/ch1/tongque/wing-shell.png",
    "pivot": [
      -54.802,
      0.0
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-shell-mirror",
    "w": 220,
    "h": 110,
    "image": "art/bosses/ch1/tongque/wing-shell-mirror.png",
    "pivot": [
      54.802,
      0.0
    ],
    "anchors": {
      "root": [
        -0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-lock",
    "w": 50,
    "h": 50,
    "image": "art/bosses/ch1/tongque/wing-lock.png",
    "pivot": [
      0.0,
      0.0
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-lock-mirror",
    "w": 50,
    "h": 50,
    "image": "art/bosses/ch1/tongque/wing-lock-mirror.png",
    "pivot": [
      -0.0,
      0.0
    ],
    "anchors": {
      "root": [
        -0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-gun",
    "w": 50,
    "h": 80,
    "image": "art/bosses/ch1/tongque/wing-gun.png",
    "pivot": [
      -0.078,
      -27.156
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "gun": [
        0.0,
        55.344
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-wing-gun-mirror",
    "w": 50,
    "h": 80,
    "image": "art/bosses/ch1/tongque/wing-gun-mirror.png",
    "pivot": [
      0.078,
      -27.156
    ],
    "anchors": {
      "root": [
        -0.0,
        0.0
      ],
      "gun": [
        -0.0,
        55.344
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-lid-half",
    "w": 50,
    "h": 100,
    "image": "art/bosses/ch1/tongque/lid-half.png",
    "pivot": [
      -15.898,
      -0.098
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-lid-half-mirror",
    "w": 50,
    "h": 100,
    "image": "art/bosses/ch1/tongque/lid-half-mirror.png",
    "pivot": [
      15.898,
      -0.098
    ],
    "anchors": {
      "root": [
        -0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-core",
    "w": 62,
    "h": 62,
    "image": "art/bosses/ch1/tongque/core.png",
    "pivot": [
      0.0,
      -0.061
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-tail-base",
    "w": 64,
    "h": 55,
    "image": "art/bosses/ch1/tongque/tail-base.png",
    "pivot": [
      0.0,
      2.677
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "leafL": [
        -19.8,
        -10.71
      ],
      "leafC": [
        0.0,
        -10.71
      ],
      "leafR": [
        19.8,
        -10.71
      ],
      "serviceLatch": [
        0.0,
        1.19
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-tail-leaf",
    "w": 55,
    "h": 145,
    "image": "art/bosses/ch1/tongque/tail-leaf.png",
    "pivot": [
      -0.142,
      51.09
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-tail-lock",
    "w": 52,
    "h": 48,
    "image": "art/bosses/ch1/tongque/tail-lock.png",
    "pivot": [
      0.0,
      7.256
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-foot",
    "w": 52,
    "h": 75,
    "image": "art/bosses/ch1/tongque/foot.png",
    "pivot": [
      0.0,
      -17.209
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-foot-mirror",
    "w": 52,
    "h": 75,
    "image": "art/bosses/ch1/tongque/foot-mirror.png",
    "pivot": [
      -0.0,
      -17.209
    ],
    "anchors": {
      "root": [
        -0.0,
        0.0
      ]
    },
    "radius": 0
  },
  {
    "id": "tq-controller",
    "w": 56,
    "h": 56,
    "image": "art/bosses/ch1/tongque/controller.png",
    "pivot": [
      0.0,
      -17.373
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  },
  // 纸扎龙灯分件：启动时统一烘焙，运行中只切帧、缩放与镜像。
  { id: 'pd-head', w: 128, h: 139, textureScale: 3,
    image: ['head-closed', 'head-turn', 'head-open'].map(name => `art/bosses/ch1/zhilong3/${name}.png`),
    anchors: { root: [0, 0], neck: [0, -48], eye: [0, 35], mouth: [0, 57] }, radius: 0 },
  // 扫描沿用独立判定点，外观由张口龙头承担。
  { id: 'pd-eye', w: 1, h: 1, draw() {}, radius: 0 },
  { id: 'pd-body', w: 90, h: 132, textureScale: 3,
    image: ['body-closed', 'body-open'].map(name => `art/bosses/ch1/zhilong3/${name}.png`),
    anchors: { root: [0, 0], jointIn: [0, -39], jointOut: [0, 39], clawL: [-27, 0], clawR: [27, 0], tail: [0, 44] }, radius: 0,
    glow(ctx, frame) {
      if (!frame) return;
      const light = ctx.createRadialGradient(0, 0, 2, 0, 0, 35);
      light.addColorStop(0, '#ffffff'); light.addColorStop(.28, '#fff6d9');
      light.addColorStop(.65, '#b89548'); light.addColorStop(1, '#000000');
      ctx.fillStyle = light; ctx.fillRect(-35, -40, 70, 80);
    } },
  { id: 'pd-claw', w: 80, h: 96, textureScale: 3,
    image: 'art/bosses/ch1/zhilong3/claw.png',
    anchors: { root: [12, -36] }, radius: 0 },
  { id: 'pd-tail', w: 95, h: 109, textureScale: 3,
    image: 'art/bosses/ch1/zhilong3/tail.png',
    pivot: [0, -42], anchors: { root: [0, 0] }, radius: 0 },
  // 清单判定沿用原尺寸，清单由 paperRegisterSvg 绘制。
  { id: 'pd-register', w: 46, h: 44, draw() {}, radius: 0 },
  { id: 'pd-stamp', w: 46, h: 56, pivot: [0, -18.287], radius: 0,
    draw(ctx) {
      ctx.fillStyle = '#3e291b'; ctx.strokeStyle = '#d6ac59'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-12, -25, 24, 17, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#873726'; ctx.fillRect(-21, -10, 42, 32); ctx.strokeRect(-21, -10, 42, 32);
      ctx.fillStyle = '#efcc87'; ctx.font = 'bold 26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('封', 0, 7);
    } }

];

// 无判定扫描提示：灰色半角25度、长500，根在扇顶。
CH1_BOSS_SPRITES.push({ id: 'pd-scan-guide', w: 430, h: 500, pivot: [0, -250], radius: 0,
  draw(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -250); ctx.lineTo(-211, 203); ctx.quadraticCurveTo(0, 250, 211, 203); ctx.closePath();
    ctx.fillStyle = 'rgba(120,132,132,.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(155,165,165,.6)'; ctx.lineWidth = 2; ctx.setLineDash([8,12]); ctx.stroke();
  },
});
