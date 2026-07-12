(function(){
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  let W, H;

  // ピクセルアート化: 実際の描画は低解像度のオフスクリーンCanvasに行い、
  // それを最後にニアレストネイバー（滑らかにしない）で拡大して表示する。
  // これによりドットの粒立ちが出て、ピクセルアートらしい質感になる。
  const PIXEL_SCALE = 3; // 1論理ピクセル = 3x3の表示ピクセル
  const pixelCanvas = document.createElement("canvas");
  const pctx = pixelCanvas.getContext("2d");

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    pixelCanvas.width = Math.ceil(W / PIXEL_SCALE);
    pixelCanvas.height = Math.ceil(H / PIXEL_SCALE);
    ctx.imageSmoothingEnabled = false;
    draw();
  }
  window.addEventListener("resize", resize);

  /* ============================================================
     アイソメトリック座標変換
     グリッド座標 (gx, gy) -> 画面座標 (sx, sy)
     タイルは幅TILE_W、高さTILE_Hの菱形（低解像度キャンバス基準のサイズ）
     ============================================================ */
  const TILE_W = 22;
  const TILE_H = 11;

  function pw(){ return pixelCanvas.width; }
  function ph(){ return pixelCanvas.height; }
  function originX(){ return pw() / 2; }
  function originY(){ return ph() / 2 - 14; }

  function gridToScreen(gx, gy){
    const sx = originX() + (gx - gy) * (TILE_W / 2);
    const sy = originY() + (gx + gy) * (TILE_H / 2);
    return { x: sx, y: sy };
  }

  function screenToGrid(sx, sy){
    // sx, sy は表示解像度座標で渡ってくるため、低解像度側に変換してから計算する
    sx = sx / PIXEL_SCALE;
    sy = sy / PIXEL_SCALE;
    const relX = sx - originX();
    const relY = sy - originY();
    const gx = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
    const gy = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
    return { gx: Math.round(gx), gy: Math.round(gy) };
  }

  /* ============================================================
     タイル描画（地面の菱形）— 低解像度コンテキスト(pctx)に描く
     ============================================================ */
  function drawTile(gx, gy, color, strokeColor){
    const p = gridToScreen(gx, gy);
    pctx.beginPath();
    pctx.moveTo(p.x, p.y - TILE_H / 2);
    pctx.lineTo(p.x + TILE_W / 2, p.y);
    pctx.lineTo(p.x, p.y + TILE_H / 2);
    pctx.lineTo(p.x - TILE_W / 2, p.y);
    pctx.closePath();
    pctx.fillStyle = color;
    pctx.fill();
    pctx.strokeStyle = strokeColor;
    pctx.lineWidth = 1;
    pctx.stroke();
  }

  /* ============================================================
     建物描画（感情ごとにスタイルを分ける）
     Kenney Isometric Buildings のタイル画像を使用する
     ============================================================ */
  const BUILDING_STYLES = {
    joy:      { file: "png/buildingTiles_123.png", label: "パン屋" },
    anger:    { file: "png/buildingTiles_113.png", label: "工房" },
    sorrow:   { file: "png/buildingTiles_092.png", label: "図書室" },
    surprise: { file: "png/buildingTiles_114.png", label: "塔" },
    thought:  { file: "png/buildingTiles_100.png", label: "書斎" },
    insight:  { file: "png/buildingTiles_124.png", label: "アトリエ", glow: true },
    calm:     { file: "png/buildingTiles_107.png", label: "民家" }
  };

  // 画像を事前読み込みしておく。読み込み中はプレースホルダーの菱形だけ描く。
  const buildingImages = {};
  let imagesLoaded = 0;
  const imageKeys = Object.keys(BUILDING_STYLES);
  imageKeys.forEach(function(key){
    const img = new Image();
    img.onload = function(){
      imagesLoaded++;
      draw();
    };
    img.src = BUILDING_STYLES[key].file;
    buildingImages[key] = img;
  });

  function drawBuilding(gx, gy, emoKey, sizeScale){
    const style = BUILDING_STYLES[emoKey] || BUILDING_STYLES.calm;
    const p = gridToScreen(gx, gy);
    const img = buildingImages[emoKey];

    // 足元の土台の影を先に敷いて、地面との継ぎ目を柔らかくする
    const baseHalfW = TILE_W / 2 * 0.82;
    const baseHalfH = TILE_H / 2 * 0.82;
    pctx.beginPath();
    pctx.moveTo(p.x, p.y - baseHalfH);
    pctx.lineTo(p.x + baseHalfW, p.y);
    pctx.lineTo(p.x, p.y + baseHalfH);
    pctx.lineTo(p.x - baseHalfW, p.y);
    pctx.closePath();
    pctx.fillStyle = "rgba(60, 70, 55, 0.16)";
    pctx.fill();

    if (!img || !img.complete || img.naturalWidth === 0){
      // 画像が未読込の間は簡易的な菱形プレースホルダーを表示
      pctx.beginPath();
      pctx.moveTo(p.x, p.y - baseHalfH);
      pctx.lineTo(p.x + baseHalfW, p.y);
      pctx.lineTo(p.x, p.y + baseHalfH);
      pctx.lineTo(p.x - baseHalfW, p.y);
      pctx.closePath();
      pctx.fillStyle = "rgba(120,120,110,0.4)";
      pctx.fill();
      return;
    }

    // Kenneyのタイル画像はタイル底辺の中央を基準に描かれているため、
    // 画像の横幅をTILE_Wに合わせて拡大縮小し、底辺中央がタイル中心に来るよう配置する
    const scale = (TILE_W / img.naturalWidth) * 1.9 * (sizeScale || 1);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = p.x - drawW / 2;
    const drawY = p.y - drawH + (TILE_H / 2) * 0.5; // 底面がタイル面に接するよう調整

    pctx.drawImage(img, drawX, drawY, drawW, drawH);

    // ひらめきの建物は光る窓を追加
    if (style.glow){
      pctx.fillStyle = "rgba(255, 240, 180, 0.9)";
      pctx.fillRect(p.x - 3, drawY + drawH * 0.35, 2, 2);
      pctx.fillRect(p.x + 1, drawY + drawH * 0.35, 2, 2);
    }
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
    buildings.push({ gx: gx, gy: gy, emoKey: emoKey, sizeScale: 0.92 + Math.random() * 0.16 });
    draw();
  }

  /* ============================================================
     描画
     ============================================================ */
  const GRID_RADIUS = 6;

  function draw(){
    const pW = pixelCanvas.width, pH = pixelCanvas.height;
    pctx.clearRect(0, 0, pW, pH);

    const bgColor = { r: 183, g: 214, b: 194 }; // body背景色 #B7D6C2 に溶け込ませる

    // 地面タイルをグリッド状に敷く。中心からの距離が遠いほど背景色に霞ませ、
    // 奥行き（地平線に向かって薄れていく感じ）を出す。
    for (let gx = -GRID_RADIUS; gx <= GRID_RADIUS; gx++){
      for (let gy = -GRID_RADIUS; gy <= GRID_RADIUS; gy++){
        const checker = (gx + gy) % 2 === 0;
        const base = checker ? { r: 169, g: 203, b: 181 } : { r: 159, g: 194, b: 171 };

        // 画面奥（gx+gyが小さい方向）ほど霞ませる
        const depth = (gx + gy + GRID_RADIUS * 2) / (GRID_RADIUS * 4); // 0(奥)〜1(手前)
        const haze = Math.max(0, 0.55 - depth * 0.55); // 奥ほどhazeが強い

        const r = Math.round(base.r + (bgColor.r - base.r) * haze);
        const g = Math.round(base.g + (bgColor.g - base.g) * haze);
        const b = Math.round(base.b + (bgColor.b - base.b) * haze);

        drawTile(gx, gy, "rgb(" + r + "," + g + "," + b + ")", "rgba(255,255,255,0.2)");
      }
    }

    // 中心に向かって淡く明るくなる放射グラデーションを重ね、地面の立体感を強調する
    const centerScreen = gridToScreen(0, 0);
    const radius = GRID_RADIUS * TILE_W;
    const grad = pctx.createRadialGradient(
      centerScreen.x, centerScreen.y, 0,
      centerScreen.x, centerScreen.y, radius
    );
    grad.addColorStop(0, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, pW, pH);

    // 建物は奥から手前へ（gx+gyが小さい順）に描画してZオーダーを正しくする
    const sorted = buildings.slice().sort(function(a, b){ return (a.gx + a.gy) - (b.gx + b.gy); });
    for (const b of sorted){
      drawBuilding(b.gx, b.gy, b.emoKey, b.sizeScale);
    }

    // 画面の上端（遠景）を背景色にフェードさせ、奥行きの終わりを演出する
    const topFadeH = pH * 0.32;
    const topFade = pctx.createLinearGradient(0, 0, 0, topFadeH);
    topFade.addColorStop(0, "rgba(183,214,194,0.55)");
    topFade.addColorStop(1, "rgba(183,214,194,0)");
    pctx.fillStyle = topFade;
    pctx.fillRect(0, 0, pW, topFadeH);

    // 低解像度キャンバスを、滑らかにせず（ドットのまま）表示用キャンバスへ拡大転写する
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelCanvas, 0, 0, pW, pH, 0, 0, pW * PIXEL_SCALE, pH * PIXEL_SCALE);
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
