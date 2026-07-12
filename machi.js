(function(){
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  let W, H;

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    draw();
  }
  window.addEventListener("resize", resize);

  /* ============================================================
     アイソメトリック座標変換
     グリッド座標 (gx, gy) -> 画面座標 (sx, sy)
     タイルは幅TILE_W、高さTILE_Hの菱形
     ============================================================ */
  const TILE_W = 64;
  const TILE_H = 32;

  function originX(){ return W / 2; }
  function originY(){ return H / 2 - 40; }

  function gridToScreen(gx, gy){
    const sx = originX() + (gx - gy) * (TILE_W / 2);
    const sy = originY() + (gx + gy) * (TILE_H / 2);
    return { x: sx, y: sy };
  }

  function screenToGrid(sx, sy){
    const relX = sx - originX();
    const relY = sy - originY();
    const gx = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
    const gy = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
    return { gx: Math.round(gx), gy: Math.round(gy) };
  }

  /* ============================================================
     タイル描画（地面の菱形）
     ============================================================ */
  function drawTile(gx, gy, color, strokeColor){
    const p = gridToScreen(gx, gy);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TILE_H / 2);
    ctx.lineTo(p.x + TILE_W / 2, p.y);
    ctx.lineTo(p.x, p.y + TILE_H / 2);
    ctx.lineTo(p.x - TILE_W / 2, p.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ============================================================
     建物描画（感情ごとにスタイルを分ける）
     箱型: 屋根(上面) + 左壁 + 右壁 の3面で立体感を出す
     ============================================================ */
  const BUILDING_STYLES = {
    joy:      { roof: "#F2C879", wallL: "#D9A24E", wallR: "#C68C3A", height: 46, label: "パン屋" },
    anger:    { roof: "#B0665A", wallL: "#8C4E44", wallR: "#743F37", height: 60, label: "工房" },
    sorrow:   { roof: "#7C93A6", wallL: "#5F7789", wallR: "#4C6272", height: 40, label: "図書室" },
    surprise: { roof: "#E0C64F", wallL: "#C2A93B", wallR: "#A48F2E", height: 70, label: "塔" },
    thought:  { roof: "#8FA07C", wallL: "#6F805F", wallR: "#5A6A4C", height: 44, label: "書斎" },
    insight:  { roof: "#F2D98A", wallL: "#E0BE5E", wallR: "#C9A548", height: 50, label: "アトリエ", glow: true },
    calm:     { roof: "#D8CBB0", wallL: "#BCAE90", wallR: "#A69777", height: 36, label: "民家" }
  };

  function drawBuilding(gx, gy, emoKey, sizeScale){
    const style = BUILDING_STYLES[emoKey] || BUILDING_STYLES.calm;
    const p = gridToScreen(gx, gy);
    const h = style.height * (sizeScale || 1);
    const halfW = TILE_W / 2;
    const halfH = TILE_H / 2;

    const top = p.y - h;

    // 左壁
    ctx.beginPath();
    ctx.moveTo(p.x - halfW, p.y);
    ctx.lineTo(p.x, p.y + halfH);
    ctx.lineTo(p.x, top + halfH);
    ctx.lineTo(p.x - halfW, top);
    ctx.closePath();
    ctx.fillStyle = style.wallL;
    ctx.fill();

    // 右壁
    ctx.beginPath();
    ctx.moveTo(p.x + halfW, p.y);
    ctx.lineTo(p.x, p.y + halfH);
    ctx.lineTo(p.x, top + halfH);
    ctx.lineTo(p.x + halfW, top);
    ctx.closePath();
    ctx.fillStyle = style.wallR;
    ctx.fill();

    // 屋根（上面の菱形）
    ctx.beginPath();
    ctx.moveTo(p.x, top - halfH);
    ctx.lineTo(p.x + halfW, top);
    ctx.lineTo(p.x, top + halfH);
    ctx.lineTo(p.x - halfW, top);
    ctx.closePath();
    ctx.fillStyle = style.roof;
    ctx.fill();

    // ひらめきの建物は光る窓を追加
    if (style.glow){
      ctx.fillStyle = "rgba(255, 240, 180, 0.9)";
      ctx.fillRect(p.x - 6, top + halfH + 6, 5, 5);
      ctx.fillRect(p.x + 2, top + halfH + 6, 5, 5);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - halfW, p.y);
    ctx.lineTo(p.x, p.y + halfH);
    ctx.lineTo(p.x + halfW, p.y);
    ctx.stroke();
  }

  /* ============================================================
     街のデータ
     ============================================================ */
  let buildings = []; // { gx, gy, emoKey, sizeScale }
  const EMOTION_CYCLE = ["joy","anger","sorrow","surprise","thought","insight","calm"];
  let cycleIdx = 0;

  function placeBuildingAt(gx, gy){
    // 既に建物がある場所には建てない
    const exists = buildings.some(function(b){ return b.gx === gx && b.gy === gy; });
    if (exists) return;
    const emoKey = EMOTION_CYCLE[cycleIdx % EMOTION_CYCLE.length];
    cycleIdx++;
    buildings.push({ gx: gx, gy: gy, emoKey: emoKey, sizeScale: 0.85 + Math.random() * 0.3 });
    draw();
  }

  /* ============================================================
     描画
     ============================================================ */
  const GRID_RADIUS = 6;

  function draw(){
    ctx.clearRect(0, 0, W, H);

    // 地面タイルをグリッド状に敷く
    for (let gx = -GRID_RADIUS; gx <= GRID_RADIUS; gx++){
      for (let gy = -GRID_RADIUS; gy <= GRID_RADIUS; gy++){
        const checker = (gx + gy) % 2 === 0;
        drawTile(gx, gy, checker ? "#A9CBB5" : "#9FC2AB", "rgba(255,255,255,0.25)");
      }
    }

    // 建物は奥から手前へ（gx+gyが小さい順）に描画してZオーダーを正しくする
    const sorted = buildings.slice().sort(function(a, b){ return (a.gx + a.gy) - (b.gx + b.gy); });
    for (const b of sorted){
      drawBuilding(b.gx, b.gy, b.emoKey, b.sizeScale);
    }
  }

  canvas.addEventListener("click", function(e){
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = screenToGrid(sx, sy);
    if (Math.abs(g.gx) <= GRID_RADIUS && Math.abs(g.gy) <= GRID_RADIUS){
      placeBuildingAt(g.gx, g.gy);
    }
  });

  resize();
})();
