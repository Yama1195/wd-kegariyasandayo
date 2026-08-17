//------------------------------------------------------------------------------
//  初期化
//------------------------------------------------------------------------------
$(function()
{
    init();
});

//------------------------------------------------------------------------------
//  画像の準備
//------------------------------------------------------------------------------
// プレイヤー画像（通常時 ＆ 毛刈り攻撃時）
const playerImg = new Image();
playerImg.src = '../../assets/img/player1.png';
playerImg.onload = function() { 
    if (typeof ctx !== 'undefined' && ctx && current_state !== GAME_STATE.PLAYING) draw(); 
};

const playerAttackImg = new Image();
playerAttackImg.src = '../../assets/img/player1_attack.png';
playerAttackImg.onload = function() { 
    if (typeof ctx !== 'undefined' && ctx && current_state !== GAME_STATE.PLAYING) draw(); 
};

// 敵キャラ画像（タイプ別に管理）
const enemyImages = {};
for (let i = 0; i < 5; i++) {
    enemyImages[i] = new Image();
    enemyImages[i].src = '../../assets/img/enemy1.png';
    enemyImages[i].onload = function() { 
        if (typeof ctx !== 'undefined' && ctx && current_state !== GAME_STATE.PLAYING) draw(); 
    };
}

//------------------------------------------------------------------------------
//  サウンド要素の準備
//------------------------------------------------------------------------------
const sound = {
    bgm: new Audio('../../assets/sound/bgm1.mp3'),
    parry: new Audio('../../assets/sound/sound_parry.mp3'),
    damage: new Audio('../../assets/sound/sound_damage.mp3')
};

sound.bgm.loop = true;
sound.bgm.volume = 0.4;
sound.parry.volume = 0.8;
sound.damage.volume = 0.7;

//------------------------------------------------------------------------------
//  ゲーム要素・変数
//------------------------------------------------------------------------------
let canvas, ctx, width, height;

// ゲームの状態管理
const GAME_STATE = {
    TITLE: 0,
    PLAYING: 1,
    GAMEOVER: 2
};
let current_state = GAME_STATE.TITLE;

// 雲の配置・個別管理用オブジェクト
let clouds = [
    { x: 100,  y: 80,  s: 0.9, speed: 0.8 },
    { x: 450,  y: 140, s: 0.6, speed: 0.5 },
    { x: 800,  y: 90,  s: 1.1, speed: 1.0 },
    { x: 1150, y: 160, s: 0.7, speed: 0.6 }
];

// --- プレイヤー ---
let player = {
    x: 0,
    y: 0,
    width: 320,
    height: 320,
    radius: 100,
    color: "#4CAF50",
    max_hp: 3,
    hp: 3,
    invincible_timer: 0
};

// --- 毛刈り ---
let shear_state = {
    is_active: false,
    timer: 0,
    duration: 12,
    cooldown: 0,
    cooldown_max: 20,
    effect_timer: 0
};

// --- 演出 ---
let hit_stop_timer = 0;
let shake_timer = 0;
let shake_intensity = 0;

// --- 敵 ---
let enemy = {
    x: 0,
    y: 0,
    base_y: 0,
    width: 240,
    height: 240,
    radius: 90,
    speed: 6,
    color: "#E91E63",
    is_alive: true,
    type: 0,
    timer: 0,
    angle: 0
};

let score = 0;

// コンボ変数
let combo = 0;
let max_combo = 0;

// ゲームオーバー画面のボタン配置情報
let buttons = {
    retry: { x: 0, y: 0, w: 180, h: 50 },
    top: { x: 0, y: 0, w: 180, h: 50 }
};

// 敵タイプの名称定義 (5種類)
const ENEMY_TYPE_NAMES = [
    "通常",
    "上下揺れ",
    "スピードUP",
    "スロー",
    "回転突撃"
];

//------------------------------------------------------------------------------
//  コントローラー
//------------------------------------------------------------------------------
function init()
{
    canvas = document.getElementById("game_canvas");
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');

    resize_canvas();

    $(window).on('resize', function() {
        resize_canvas();
    });

    $('#btn_start').off('click').on('click', function() {
        game_start();
    });

    $(window).off('keydown').on('keydown', function(e) {
        if (e.code === 'Space') {
            if (current_state === GAME_STATE.PLAYING) {
                trigger_shear();
            }
        }
    });

    $(canvas).off('pointerdown').on('pointerdown', function(e) {
        if (current_state === GAME_STATE.PLAYING) {
            trigger_shear();
        } else if (current_state === GAME_STATE.GAMEOVER) {
            check_game_over_click(e);
        }
    });

    draw();
}

function check_game_over_click(e)
{
    let rect = canvas.getBoundingClientRect();
    let click_x = e.clientX - rect.left;
    let click_y = e.clientY - rect.top;

    if (click_x >= buttons.retry.x && click_x <= buttons.retry.x + buttons.retry.w &&
        click_y >= buttons.retry.y && click_y <= buttons.retry.y + buttons.retry.h) {
        prepare_retry();
    }
    else if (click_x >= buttons.top.x && click_x <= buttons.top.x + buttons.top.w &&
             click_y >= buttons.top.y && click_y <= buttons.top.y + buttons.top.h) {
        go_to_top();
    }
}

function resize_canvas()
{
    if (!canvas) return;
    canvas.width = window.innerWidth || 800;
    canvas.height = window.innerHeight || 600;
    width = canvas.width;
    height = canvas.height;

    player.x = width - 240;
    player.y = height * 0.65;

    buttons.retry.x = width / 2 - 200;
    buttons.retry.y = height / 2 + 60;
    
    buttons.top.x = width / 2 + 20;
    buttons.top.y = height / 2 + 60;

    if (current_state !== GAME_STATE.PLAYING) {
        draw();
    }
}

//------------------------------------------------------------------------------
//  画面遷移コントロール
//------------------------------------------------------------------------------

function game_start()
{
    $('#btn_start').addClass('hide');
    $('#btn_start').parent().addClass('hide');

    restart_game();
}

function prepare_retry()
{
    current_state = GAME_STATE.TITLE;
    
    player.hp = player.max_hp;
    player.invincible_timer = 0;
    score = 0;
    combo = 0;
    max_combo = 0;
    hit_stop_timer = 0;
    shake_timer = 0;
    shear_state.is_active = false;
    shear_state.cooldown = 0;
    reset_enemy();

    $('#btn_start').removeClass('hide');
    $('#btn_start').parent().removeClass('hide');

    draw();
}

function restart_game()
{
    current_state = GAME_STATE.PLAYING;
    
    player.hp = player.max_hp;
    player.invincible_timer = 0;
    score = 0;
    combo = 0;
    max_combo = 0;
    hit_stop_timer = 0;
    shake_timer = 0;
    shear_state.is_active = false;
    shear_state.cooldown = 0;
    reset_enemy();

    try {
        sound.bgm.currentTime = 0;
        let playPromise = sound.bgm.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log("BGM再生制限:", e));
        }
    } catch(e) {
        console.log("BGM再生エラー:", e);
    }

    game_loop();
}

function go_to_top()
{
    try {
        sound.bgm.pause();
        sound.bgm.currentTime = 0;
    } catch(e) {}

    window.location.href = '../../../index.html';
}

function play_se(audio_obj)
{
    try {
        audio_obj.currentTime = 0;
        let playPromise = audio_obj.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log("SE再生制限:", e));
        }
    } catch(e) {}
}

function trigger_shear()
{
    if (shear_state.cooldown <= 0 && !shear_state.is_active) {
        shear_state.is_active = true;
        shear_state.timer = shear_state.duration;
        shear_state.cooldown = shear_state.cooldown_max;
    }
}

function reset_enemy()
{
    enemy.x = -enemy.radius * 2;
    enemy.base_y = (height || 600) * 0.70;
    enemy.y = enemy.base_y;
    enemy.is_alive = true;
    enemy.timer = 0;
    enemy.angle = 0;

    // 5種類の敵タイプからランダム選出
    enemy.type = Math.floor(Math.random() * 5);

    let speed_bonus = Math.min(score * 0.3, 6);

    switch (enemy.type) {
        case 0: // 通常
            enemy.speed = (6 + Math.random() * 2) + speed_bonus;
            enemy.color = "#E91E63";
            break;
        case 1: // 上下
            enemy.speed = 5.5 + speed_bonus;
            enemy.color = "#9C27B0";
            break;
        case 2: // スピードUP
            enemy.speed = 13 + speed_bonus;
            enemy.color = "#FFEB3B";
            break;
        case 3: // スロー
            enemy.speed = 3.5 + Math.min(score * 0.1, 2);
            enemy.color = "#00BCD4";
            break;
        case 4: // 回転
            enemy.speed = 7 + speed_bonus;
            enemy.color = "#4CAF50";
            break;
    }
}

//------------------------------------------------------------------------------
//  パーツ描画パーツ：雲
//------------------------------------------------------------------------------
function drawCloud(ctx, x, y, size = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);

    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.arc(-25, -25, 35, 0, Math.PI * 2);
    ctx.arc(25, -25, 35, 0, Math.PI * 2);
    ctx.arc(-50, 0, 30, 0, Math.PI * 2);
    ctx.arc(50, 0, 30, 0, Math.PI * 2);
    ctx.arc(-30, 20, 25, 0, Math.PI * 2);
    ctx.arc(0, 25, 25, 0, Math.PI * 2);
    ctx.arc(30, 20, 25, 0, Math.PI * 2);

    ctx.fill();
    ctx.restore();
}

//------------------------------------------------------------------------------
//  パーツ描画パーツ：いらすとや風の絵本調草原
//------------------------------------------------------------------------------
function drawGrassland(ctx, width, height, ground_y) {
    ctx.fillStyle = "#8BC34A";
    ctx.beginPath();
    ctx.moveTo(0, ground_y - 5);
    ctx.quadraticCurveTo(width * 0.35, ground_y + 10, width * 0.7, ground_y - 5);
    ctx.quadraticCurveTo(width * 0.85, ground_y - 12, width, ground_y - 2);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    ctx.fillStyle = "#AED581";
    let rows = 4;
    let cols = Math.floor(width / 45);

    for (let r = 0; r < rows; r++) {
        let row_y = ground_y + 35 + r * 30;
        let offset_x = (r % 2 === 0) ? 0 : 22;

        for (let c = 0; c < cols; c++) {
            let gx = c * 45 + offset_x + ((c * 7) % 8);
            let gy = row_y + ((c * 13) % 6);

            if (gy < height - 20) {
                ctx.beginPath();
                ctx.ellipse(gx, gy, 4, 8, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

//------------------------------------------------------------------------------
//  メインループ
//------------------------------------------------------------------------------
function game_loop()
{
    if (current_state !== GAME_STATE.PLAYING && current_state !== GAME_STATE.GAMEOVER) return;

    try {
        if (current_state === GAME_STATE.PLAYING) {
            if (hit_stop_timer > 0) {
                hit_stop_timer--;
            } else {
                update();
            }
        }

        draw();

        if (current_state === GAME_STATE.PLAYING) {
            requestAnimationFrame(game_loop);
        }
    } catch(err) {
        console.error("ゲームループ中にエラーが発生しました:", err);
    }
}

//------------------------------------------------------------------------------
//  更新処理
//------------------------------------------------------------------------------
function update()
{
    for (let c of clouds) {
        c.x -= c.speed;
        if (c.x < -150) {
            c.x += (width || 800) + 300;
        }
    }

    if (shear_state.is_active) {
        shear_state.timer--;
        if (shear_state.timer <= 0) {
            shear_state.is_active = false;
        }
    }
    if (shear_state.cooldown > 0) shear_state.cooldown--;
    if (shear_state.effect_timer > 0) shear_state.effect_timer--;
    if (player.invincible_timer > 0) player.invincible_timer--;

    if (enemy.is_alive) {
        enemy.timer++;

        switch (enemy.type) {
            case 0: // 通常
            case 2: // スピードUP
            case 3: // スロー
                enemy.x += enemy.speed;
                break;

            case 1: // 上下揺れ
                enemy.x += enemy.speed;
                enemy.y = enemy.base_y + Math.sin(enemy.timer * 0.1) * 60;
                break;

            case 4: // 回転突撃
                enemy.x += enemy.speed;
                enemy.angle += 0.15;
                break;
        }

        // --- 当たり判定の計算 ---
        let dist_shear = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        let player_damage_x = player.x + 40;
        let dist_damage = Math.hypot(player_damage_x - enemy.x, player.y - enemy.y);

        // 毛刈り（パリィ）判定
        if (shear_state.is_active && dist_shear < player.radius + enemy.radius + 40) {
            enemy.is_alive = false;
            score++;
            combo++;
            if (combo > max_combo) {
                max_combo = combo;
            }

            shear_state.effect_timer = 20;

            play_se(sound.parry);
            hit_stop_timer = 6;
            shake_timer = 12;
            shake_intensity = 15;

            setTimeout(reset_enemy, 800);
        } 
        // 被ダメージ判定
        else if (dist_damage < player.radius + enemy.radius - 20) {
            enemy.is_alive = false;
            player.hp--;
            combo = 0;
            player.invincible_timer = 30;

            play_se(sound.damage);
            shake_timer = 15;
            shake_intensity = 10;

            if (player.hp <= 0) {
                current_state = GAME_STATE.GAMEOVER;
                try {
                    sound.bgm.pause();
                } catch(e) {}
            } else {
                setTimeout(reset_enemy, 1000);
            }
        }

        if (enemy.x > (width || 800) + 100) {
            reset_enemy();
        }
    }
}

//------------------------------------------------------------------------------
//  描画処理
//------------------------------------------------------------------------------
function draw()
{
    if (!ctx) return;

    ctx.save();

    if (shake_timer > 0) {
        shake_timer--;
        let offset_x = (Math.random() - 0.5) * shake_intensity * 2;
        let offset_y = (Math.random() - 0.5) * shake_intensity * 2;
        ctx.translate(offset_x, offset_y);
    }

    ctx.clearRect(-20, -20, (width || 800) + 40, (height || 600) + 40);

    // 1. 背景描画
    ctx.fillStyle = "#B3E5FC";
    ctx.fillRect(0, 0, width || 800, height || 600);

    for (let c of clouds) {
        drawCloud(ctx, c.x, c.y, c.s);
    }

    // 2. 地面
    let ground_y = player.y + player.radius;
    drawGrassland(ctx, width || 800, height || 600, ground_y);

    // 3. プレイヤー描画
    if (player.invincible_timer % 4 < 2) {
        let currentDrawImg = (current_state === GAME_STATE.PLAYING && shear_state.is_active)
            ? playerAttackImg
            : playerImg;

        if (currentDrawImg.complete && currentDrawImg.naturalWidth !== 0) {
            ctx.drawImage(
                currentDrawImg,
                player.x - player.width / 2,
                player.y - player.height / 2,
                player.width,
                player.height
            );
        }
    }

    // 4. 敵描画
    if (current_state === GAME_STATE.PLAYING && enemy.is_alive) {
        let currentEnemyImg = enemyImages[enemy.type];

        ctx.save();
        ctx.translate(enemy.x, enemy.y);

        if (enemy.type === 4) {
            ctx.rotate(enemy.angle);
        }

        if (currentEnemyImg && currentEnemyImg.complete && currentEnemyImg.naturalWidth !== 0) {
            ctx.drawImage(
                currentEnemyImg,
                -enemy.width / 2,
                -enemy.height / 2,
                enemy.width,
                enemy.height
            );
        }
        ctx.restore();
    }

    // 5. 毛刈り成功テキスト ＆ 連続毛刈り数表示
    if (shear_state.effect_timer > 0) {
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 44px sans-serif";
        ctx.fillText("毛刈り成功!!", player.x - 80, player.y - 180);

        if (combo >= 2) {
            ctx.fillStyle = "#FF5722";
            ctx.font = "bold 36px sans-serif";
            ctx.fillText("連続毛刈り " + combo + "回!", player.x - 70, player.y - 230);
        }
    }

    // 6. UI表示
    if (current_state !== GAME_STATE.TITLE) {
        ctx.fillStyle = "#333";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("毛刈り成功数: " + score, 20, 40);

        if (combo >= 2) {
            ctx.fillStyle = "#FF5722";
            ctx.fillText("連続毛刈り数: " + combo, 20, 70);
        } else {
            ctx.fillStyle = "#888";
            ctx.fillText("連続毛刈り数: 0", 20, 70);
        }

        let hp_hearts = "";
        for (let i = 0; i < player.max_hp; i++) {
            hp_hearts += (i < player.hp) ? "❤️" : "🖤";
        }
        ctx.fillStyle = "#333";
        ctx.fillText("たいりょく: " + hp_hearts, 20, 105);

        let type_name = ENEMY_TYPE_NAMES[enemy.type] || "通常";
        ctx.font = "16px sans-serif";
        ctx.fillText("つぎの敵: " + type_name, 20, 135);
    }

    // 7. ゲームオーバー画面描画
    if (current_state === GAME_STATE.GAMEOVER) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(-20, -20, (width || 800) + 40, (height || 600) + 40);

        ctx.textAlign = "center";

        ctx.fillStyle = "#FF3333";
        ctx.font = "bold 52px sans-serif";
        ctx.fillText("ゲームオーバー", (width || 800) / 2, (height || 600) / 2 - 70);

        ctx.fillStyle = "#FFF";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("最終スコア: " + score + " 回成功", (width || 800) / 2, (height || 600) / 2 - 10);

        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("最大連続毛刈り数: " + max_combo + " 回", (width || 800) / 2, (height || 600) / 2 + 25);

        // ボタン1: もう一度あそぶ
        ctx.fillStyle = "#4CAF50";
        ctx.fillRect(buttons.retry.x, buttons.retry.y, buttons.retry.w, buttons.retry.h);
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("もう一度あそぶ", buttons.retry.x + buttons.retry.w / 2, buttons.retry.y + 32);

        // ボタン2: タイトルへ戻る
        ctx.fillStyle = "#757575";
        ctx.fillRect(buttons.top.x, buttons.top.y, buttons.top.w, buttons.top.h);
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("タイトルへ戻る", buttons.top.x + buttons.top.w / 2, buttons.top.y + 32);

        ctx.textAlign = "left";
    }

    ctx.restore();
}