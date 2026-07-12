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
     建物描画: 壁パーツ（ランダム）+ 屋根パーツ（感情で固定、なしもあり）を重ねて描く
     Kenney Isometric Buildings のタイル画像を使用する
     ============================================================ */
  // 壁パーツの候補（上が空洞の完成箱）。建物ごとにこの中からランダムに1つ選ぶ。
  const WALL_FILES = [
    "png/buildingTiles_000.png",
    "png/buildingTiles_007.png",
    "png/buildingTiles_014.png"
  ];
  // 感情ごとの屋根パーツ。nullの場合は屋根を乗せず、平屋根のまま。
  const ROOF_STYLES = {
    joy:      { file: "png/buildingTiles_069.png", label: "パン屋" },
    anger:    { file: "png/buildingTiles_065.png", label: "工房" },
    sorrow:   { file: null, label: "図書室" },
    surprise: { file: "png/buildingTiles_074.png", label: "塔" },
    thought:  { file: "png/buildingTiles_057.png", label: "書斎" },
    insight:  { file: null, label: "アトリエ", glow: true },
    calm:     { file: null, label: "民家" }
  };

  // 画像を事前読み込みしておく。読み込み中はプレースホルダーの菱形だけ描く。
  const wallImages = WALL_FILES.map(function(src){
    const img = new Image();
    img.onload = draw;
    img.src = src;
    return img;
  });
  const roofImages = {};
  Object.keys(ROOF_STYLES).forEach(function(key){
    const file = ROOF_STYLES[key].file;
    if (!file) return;
    const img = new Image();
    img.onload = draw;
    img.src = file;
    roofImages[key] = img;
  });

  function pickWallIndex(){
    return Math.floor(Math.random() * WALL_FILES.length);
  }

  function drawBuilding(gx, gy, emoKey, sizeScale, wallIdx){
    const style = ROOF_STYLES[emoKey] || ROOF_STYLES.calm;
    const p = gridToScreen(gx, gy);
    const wallImg = wallImages[wallIdx !== undefined ? wallIdx : 0];
    const roofImg = roofImages[emoKey];

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

    if (!wallImg || !wallImg.complete || wallImg.naturalWidth === 0){
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
    // 低解像度キャンバス上では非整数座標がサブピクセルのズレを生みやすいため、整数に丸める。
    const scale = (TILE_W / wallImg.naturalWidth) * 1.02 * (sizeScale || 1);
    const wallW = Math.round(wallImg.naturalWidth * scale);
    const wallH = Math.round(wallImg.naturalHeight * scale);
    const wallX = Math.round(p.x - wallW / 2);
    const wallY = Math.round(p.y - wallH + (TILE_H / 2) * 0.62); // 底面がタイル面に接するよう調整

    pctx.drawImage(wallImg, wallX, wallY, wallW, wallH);

    // 屋根パーツがあれば、壁の上端に重ねて描く。
    // 屋根の底辺・壁の開口部はどちらも山型（アイソメトリックな菱形の縁）をしているため、
    // フレーム同士を単純に接触させると両端に隙間ができる。屋根を意図的に沈み込ませて隠す。
    if (roofImg && roofImg.complete && roofImg.naturalWidth > 0){
      const roofScale = (TILE_W / roofImg.naturalWidth) * 1.02 * (sizeScale || 1);
      const roofW = Math.round(roofImg.naturalWidth * roofScale);
      const roofH = Math.round(roofImg.naturalHeight * roofScale);
      // 壁と同じ中心x座標(wallX + wallW/2)から屋根の中心を計算し、必ず同じ整数中心に揃える
      const centerX = wallX + Math.round(wallW / 2);
      const roofX = Math.round(centerX - roofW / 2);
      // 屋根底面の山型の縁が壁の開口部の縁に隠れるよう、屋根を壁の中に沈み込ませる
      const sinkAmount = Math.round(roofH * 0.6);
      const roofY = wallY - roofH + sinkAmount;
      pctx.drawImage(roofImg, roofX, roofY, roofW, roofH);
    }

    // ひらめきの建物は光る窓を追加
    if (style.glow){
      pctx.fillStyle = "rgba(255, 240, 180, 0.9)";
      pctx.fillRect(p.x - 3, wallY + wallH * 0.3, 2, 2);
      pctx.fillRect(p.x + 1, wallY + wallH * 0.3, 2, 2);
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
    buildings.push({ gx: gx, gy: gy, emoKey: emoKey, sizeScale: 0.92 + Math.random() * 0.16, wallIdx: pickWallIndex() });
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

    // 建物が建っているタイルに隣接する空きタイルは「道」として扱う。
    // key "gx,gy" -> true のセットで管理する。
    const roadSet = {};
    const buildingSet = {};
    for (const b of buildings) buildingSet[b.gx + "," + b.gy] = true;
    const neighborOffsets = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const b of buildings){
      for (const off of neighborOffsets){
        const nx = b.gx + off[0], ny = b.gy + off[1];
        const key = nx + "," + ny;
        if (!buildingSet[key]) roadSet[key] = true;
      }
    }

    // 地面タイルをグリッド状に敷く。中心からの距離が遠いほど背景色に霞ませ、
    // 奥行き（地平線に向かって薄れていく感じ）を出す。
    for (let gx = -GRID_RADIUS; gx <= GRID_RADIUS; gx++){
      for (let gy = -GRID_RADIUS; gy <= GRID_RADIUS; gy++){
        const isRoad = roadSet[gx + "," + gy];
        const checker = (gx + gy) % 2 === 0;
        const base = isRoad
          ? (checker ? { r: 168, g: 165, b: 158 } : { r: 158, g: 155, b: 149 }) // 道はグレー系
          : (checker ? { r: 169, g: 203, b: 181 } : { r: 159, g: 194, b: 171 }); // 地面は緑系

        // 画面奥（gx+gyが小さい方向）ほど霞ませる
        const depth = (gx + gy + GRID_RADIUS * 2) / (GRID_RADIUS * 4); // 0(奥)〜1(手前)
        const haze = Math.max(0, 0.55 - depth * 0.55); // 奥ほどhazeが強い

        const r = Math.round(base.r + (bgColor.r - base.r) * haze);
        const g = Math.round(base.g + (bgColor.g - base.g) * haze);
        const b2 = Math.round(base.b + (bgColor.b - base.b) * haze);

        drawTile(gx, gy, "rgb(" + r + "," + g + "," + b2 + ")", "rgba(255,255,255,0.2)");
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
      drawBuilding(b.gx, b.gy, b.emoKey, b.sizeScale, b.wallIdx);
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
