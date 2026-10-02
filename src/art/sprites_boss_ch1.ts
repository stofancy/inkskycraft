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
  {
    "id": "pd-head",
    "w": 90,
    "h": 110,
    "image": "art/bosses/ch1/zhilong/head.png",
    "pivot": [
      0.0,
      1.891
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "neck": [
        0.0,
        -43.012
      ],
      "eye": [
        0.0,
        -9.453
      ],
      "mouth": [
        0.0,
        39.703
      ]
    },
    "radius": 0
  },
  {
    "id": "pd-eye-lid",
    "w": 55,
    "h": 40,
    "image": "art/bosses/ch1/zhilong/eye-lid.png",
    "pivot": [
      0.0,
      -6.224
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
    "id": "pd-body",
    "w": 64,
    "h": 82,
    "image": "art/bosses/ch1/zhilong/body.png",
    "pivot": [
      0.0,
      0.0
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "jointIn": [
        0.0,
        -32.416
      ],
      "jointOut": [
        0.0,
        32.416
      ],
      "register": [
        0.0,
        0.0
      ],
      "stampSocket": [
        0.0,
        12.684
      ],
      "tail": [
        0.0,
        32.416
      ]
    },
    "radius": 0
  },
  {
    "id": "pd-hinge",
    "w": 24,
    "h": 24,
    "image": "art/bosses/ch1/zhilong/hinge.png",
    "pivot": [
      -0.023,
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
    "id": "pd-register",
    "w": 46,
    "h": 44,
    "image": "art/bosses/ch1/zhilong/register.png",
    "pivot": [
      0.0,
      0.0
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ],
      "mouth": [
        0.0,
        8.549
      ]
    },
    "radius": 0
  },
  {
    "id": "pd-stamp",
    "w": 46,
    "h": 56,
    "image": "art/bosses/ch1/zhilong/stamp.png",
    "pivot": [
      0.0,
      -18.287
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
    "id": "pd-tail",
    "w": 90,
    "h": 75,
    "image": "art/bosses/ch1/zhilong/tail.png",
    "pivot": [
      0.0,
      -24.495
    ],
    "anchors": {
      "root": [
        0.0,
        0.0
      ]
    },
    "radius": 0
  }
];

// 无判定扫描提示：灰色半角25度、长500，根在扇顶。
CH1_BOSS_SPRITES.push({ id: 'pd-scan-guide', w: 430, h: 500, pivot: [0, -250], radius: 0,
  draw(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -250); ctx.lineTo(-211, 203); ctx.quadraticCurveTo(0, 250, 211, 203); ctx.closePath();
    ctx.fillStyle = 'rgba(120,132,132,.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(155,165,165,.6)'; ctx.lineWidth = 2; ctx.setLineDash([8,12]); ctx.stroke();
  },
});
