(() => {
  "use strict";
  const STORAGE_KEY = "site-meeting-board-v2";
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const makePage = (name,path,status="proposed",children=[],purpose="",nav=false,priority="normal") => ({id:uid("p"),name,path,status,children,purpose,nav,priority});
  const makeSectionChain = items => items.reduceRight((children,item) => [makePage(item[0],item[1],item[2],children,item[3],item[5]||false,item[4]||"normal")], []);
  const starters = {
    corporate: () => [makePage("ホーム","/","confirmed",[
      makePage("私たちについて","/about/","pending",[makePage("会社概要","/about/company/"),makePage("代表メッセージ","/about/message/"),makePage("採用情報","/recruit/","proposed",[],"応募者へ働く魅力を伝える")],"会社の姿勢と信頼性を伝える",true,"high"),
      makePage("事業・サービス","/services/","pending",[makePage("サービス詳細","/services/detail/"),makePage("選ばれる理由","/services/reason/")],"提供価値を理解してもらう",true,"high"),
      makePage("実績・事例","/works/","proposed",[],"実績から安心感を持ってもらう",true),
      makePage("お知らせ","/news/","proposed",[],"最新情報を発信する",true,"low"),
      makePage("お問い合わせ","/contact/","confirmed",[],"相談・問い合わせにつなげる",true,"high")
    ],"すべての入口となるページ",false,"high")],
    service: () => [makePage("トップページ","/","confirmed",[
      makePage("お客様の悩み","/problems/","pending",[],"訪問者に自分ごと化してもらう",true,"high"),makePage("サービスの特徴","/features/","pending",[makePage("よくある質問","/faq/","proposed",[],"申込み前の不安を減らす")],"解決方法と価値を伝える",true,"high"),makePage("料金・プラン","/price/","pending",[],"検討に必要な条件を示す",true,"high"),makePage("導入事例","/cases/","proposed",[],"成果を具体的に示す",true),makePage("相談・申込み","/contact/","confirmed",[],"問い合わせを受け付ける",true,"high")
    ],"サービスの価値を短時間で伝える",false,"high")],
    single: () => [makePage("シングルカラムサイト","/","confirmed",makeSectionChain([
      ["メインビジュアル","#top","confirmed","サイトの内容と第一印象を伝える","high",false],
      ["私たちについて","#about","pending","会社や活動について知ってもらう","high",true],
      ["サービス・事業内容","#services","pending","提供している内容を分かりやすく紹介する","high",true],
      ["実績・事例","#works","proposed","これまでの取り組みと信頼性を伝える","normal",true],
      ["お知らせ","#news","proposed","最新情報を掲載する","low",true],
      ["お問い合わせ","#contact","confirmed","相談や問い合わせを受け付ける","high",true]
    ]),"主要な情報を1ページの縦一列にまとめる",false,"high")],
    blank: () => []
  };
  const defaults = () => ({meta:{client:"",project:"Webサイト制作",date:new Date().toISOString().slice(0,10),participants:"",goal:"",target:"",action:"",siteType:"",launch:"",pageBudget:"",memo:""},pages:starters.corporate(),notes:[{id:uid("n"),type:"question",text:"既存サイトから引き継ぐ情報はありますか？",owner:"",due:"",done:false},{id:uid("n"),type:"question",text:"お問い合わせ後の対応フローを確認する",owner:"",due:"",done:false}],wireframes:{},wireDevice:"desktop",selectedWireframePageId:""});
  let state = load() || defaults();
  state.wireframes ||= {};
  state.wireframeInitialized ||= {};
  state.wireframeCustomized ||= {};
  if(state.wireframeSyncVersion!==3){
    state.wireframes={};
    state.wireframeInitialized={};
    state.wireframeCustomized={};
    state.wireframeSyncVersion=3;
  }
  state.wireDevice = state.wireDevice === "mobile" ? "mobile" : "desktop";
  state.wireMood = ["trust","friendly","modern"].includes(state.wireMood) ? state.wireMood : "trust";
  state.selectedWireframePageId ||= "";
  let mapView = state.mapView === "directory" ? "directory" : "tree";
  let draggedId = null;
  let pointerDrag = null;
  let wireResize = null;
  let pendingWireImage = null;
  let toastTimer;
  let pdfObjectUrl="";
  function migrateHeaderToFive(value){
    const root=value?.pages?.[0];
    if(!root||!Array.isArray(root.children)||root.children.length!==6)return value;
    const moves={"採用情報":"私たちについて","よくある質問":"サービスの特徴","数字で見る会社":"私たちの想い"};
    const extra=root.children.find(child=>moves[child.name]);
    const destination=extra&&root.children.find(child=>child.name===moves[extra.name]);
    if(extra&&destination){root.children=root.children.filter(child=>child!==extra);extra.nav=false;destination.children=destination.children||[];destination.children.push(extra)}
    return value;
  }
  function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!(v&&v.meta&&Array.isArray(v.pages)&&Array.isArray(v.notes)))return null;const root=v.pages[0];if(root?.name==="ランディングページ"&&root.children?.[0]?.name==="ファーストビュー")v.pages=starters.single();return migrateHeaderToFive(v)}catch{return null}}
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));const el=$("#saveState");el.lastChild.textContent=" 保存中…";clearTimeout(save.timer);save.timer=setTimeout(()=>el.lastChild.textContent=" この端末に自動保存",450)}
  function walk(nodes=state.pages,depth=0,parent=null,out=[]){nodes.forEach((node,index)=>{out.push({node,depth,parent,index,nodes});walk(node.children||[],depth+1,node,out)});return out}
  function findPage(id,nodes=state.pages){for(let index=0;index<nodes.length;index++){if(nodes[index].id===id)return{node:nodes[index],nodes,index};const hit=findPage(id,nodes[index].children||[]);if(hit)return hit}return null}
  function includes(node,id){return node.id===id||(node.children||[]).some(c=>includes(c,id))}
  function collectPageIds(node,out=[]){out.push(node.id);(node.children||[]).forEach(child=>collectPageIds(child,out));return out}
  function inheritedChildPath(parentId){
    const path=String(findPage(parentId)?.node?.path||"").trim();
    if(!path)return "";
    if(path.startsWith("/")&&!path.endsWith("/"))return path+"/";
    return path;
  }
  function normalizeInternalPath(path){
    const value=String(path||"").trim();
    if(!value.startsWith("/")||value.startsWith("//"))return "";
    const parts=value.split(/[?#]/,1)[0].split("/").filter(Boolean);
    return parts.length?`/${parts.join("/")}/`:"/";
  }
  function rebaseSubtreePaths(node,parentPath){
    const parent=normalizeInternalPath(parentPath),current=normalizeInternalPath(node.path),parts=current.split("/").filter(Boolean);
    if(parent&&parts.length){
      const slug=parts.at(-1);
      node.path=parent==="/"?`/${slug}/`:`${parent}${slug}/`;
    }
    const childParent=normalizeInternalPath(node.path)||parent;
    (node.children||[]).forEach(child=>rebaseSubtreePaths(child,childParent));
  }
  function scheduleTreeConnectors(){
    cancelAnimationFrame(scheduleTreeConnectors.frame);
    scheduleTreeConnectors.frame=requestAnimationFrame(()=>requestAnimationFrame(renderTreeConnectors));
  }
  function renderTreeConnectors(){
    const canvas=$("#sitemapCanvas"),root=$(".map-root",canvas);
    if(!canvas||!root||canvas.hidden)return;
    $(".tree-connectors",canvas)?.remove();
    const width=Math.max(canvas.clientWidth,canvas.scrollWidth),height=Math.max(canvas.clientHeight,canvas.scrollHeight);
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.classList.add("tree-connectors");
    svg.setAttribute("width",width);svg.setAttribute("height",height);svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
    const canvasBox=canvas.getBoundingClientRect(),toPoint=rect=>({left:rect.left-canvasBox.left+canvas.scrollLeft,top:rect.top-canvasBox.top+canvas.scrollTop,right:rect.right-canvasBox.left+canvas.scrollLeft,bottom:rect.bottom-canvasBox.top+canvas.scrollTop,width:rect.width});
    $$(".map-node",root).forEach(node=>{
      const parentCard=$(":scope > .page-card",node),children=$(":scope > .map-children",node);
      if(!parentCard||!children)return;
      const parent=toPoint(parentCard.getBoundingClientRect()),parentX=parent.left+parent.width/2;
      $$(":scope > .map-node",children).forEach(childNode=>{
        const childCard=$(":scope > .page-card",childNode);if(!childCard)return;
        const child=toPoint(childCard.getBoundingClientRect()),childX=child.left+child.width/2,junctionY=parent.bottom+Math.min(36,Math.max(18,(child.top-parent.bottom)/2));
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d",`M ${parentX} ${parent.bottom} V ${junctionY} H ${childX} V ${child.top}`);
        svg.append(path);
      });
    });
    canvas.prepend(svg);
  }
  function bindFields(){const fields={clientName:"client",projectName:"project",meetingDate:"date",participants:"participants",siteGoal:"goal",targetUser:"target",mainAction:"action",launchTiming:"launch",pageBudget:"pageBudget",freeMemo:"memo"};Object.entries(fields).forEach(([id,key])=>{const input=$("#"+id);input.value=state.meta[key]||"";input.addEventListener("input",()=>{state.meta[key]=input.value;save();updateProgress();renderWireframe()})});$$('#siteTypeChoices button').forEach(btn=>{btn.classList.toggle("active",btn.dataset.value===state.meta.siteType);btn.addEventListener("click",()=>{state.meta.siteType=btn.dataset.value;$$('#siteTypeChoices button').forEach(b=>b.classList.toggle("active",b===btn));save();updateProgress()})})}
  function updateProgress(){const metaKeys=["client","project","date","participants","goal","target","action","siteType","launch"];const metaScore=metaKeys.filter(k=>String(state.meta[k]||"").trim()).length;const all=walk();const pageScore=all.length?all.filter(x=>x.node.purpose&&x.node.status!=="proposed").length/all.length*4:0;const notesScore=state.notes.some(n=>n.type==="decision")?1:0;const rate=Math.min(100,Math.round((metaScore+pageScore+notesScore)/14*100));$("#completionRate").textContent=rate+"%";$("#progressBar").style.width=rate+"%"}
  function render(){renderMap();renderNotes();renderWireframe();updateProgress()}
  function renderMap(){const all=walk();$("#totalPages").textContent=all.length;$("#headerPages").textContent=all.filter(x=>x.node.nav).length;$("#confirmedPages").textContent=all.filter(x=>x.node.status==="confirmed").length;$("#pendingPages").textContent=all.filter(x=>x.node.status==="pending").length;$("#mapHelp").textContent=mapView==="tree"?"カードをドラッグ：横並びは左右端、縦並びは上下端で並べ替え、中央へ置くと子ページになります。":"階層順の一覧です。URL・状態・優先度・ヘッダー掲載・ページの役割をまとめて確認できます。";const canvas=$("#sitemapCanvas"),directory=$("#directoryMap"),empty=$("#emptySitemap");$$('[data-map-view]').forEach(button=>button.classList.toggle("active",button.dataset.mapView===mapView));empty.hidden=!!all.length;canvas.hidden=!all.length||mapView!=="tree";directory.hidden=!all.length||mapView!=="directory";if(!all.length)return;if(mapView==="tree"){const root=document.createElement("ul");root.className="map-root";state.pages.forEach(p=>root.append(createNode(p)));canvas.replaceChildren(root)}else renderDirectory(all)}
  function renderDirectory(all){
    const map=$("#directoryMap"),singleColumnDirectory=state.pages.length===1&&state.pages[0]?.path==="/"&&all.length>1&&all.slice(1).every(item=>String(item.node.path||"").startsWith("#")),maxDepth=singleColumnDirectory?2:Math.max(3,...all.map(item=>item.depth+1));
    map.replaceChildren();
    const table=document.createElement("table");table.className="directory-table";table.style.setProperty("--directory-levels",maxDepth);
    const thead=document.createElement("thead"),headRow=document.createElement("tr");
    for(let level=1;level<=maxDepth;level++){const th=document.createElement("th");th.textContent=`第${level}階層`;headRow.append(th)}
    const infoHead=document.createElement("th");infoHead.textContent="URL / ページ情報";headRow.append(infoHead);thead.append(headRow);table.append(thead);
    const countRows=node=>1+(node.children||[]).reduce((sum,child)=>sum+countRows(child),0);
    const tbody=document.createElement("tbody");
    const appendPage=(node,depth)=>{
      const displayDepth=singleColumnDirectory&&depth>0?1:depth;
      const row=document.createElement("tr");row.dataset.id=node.id;
      const isSectionTop=displayDepth===1||(displayDepth>1&&(node.children||[]).length>0);
      const colorClass=`level-${displayDepth+1}${isSectionTop?" is-section-top":""}`;
      const levelCell=document.createElement("th");levelCell.className=`directory-level-cell ${colorClass}`;levelCell.scope="row";levelCell.rowSpan=singleColumnDirectory&&depth>0?1:countRows(node);
      const name=document.createElement("strong");name.textContent=node.name||"名称未設定";levelCell.append(name);row.append(levelCell);
      const details=document.createElement("td");details.className=`directory-details ${colorClass}`;
      const meta=document.createElement("div");meta.className="directory-meta";
      if(node.nav){const nav=document.createElement("span");nav.className="directory-nav-badge";nav.textContent="ヘッダー掲載";meta.append(nav)}
      const path=document.createElement("code");path.textContent=node.path||"URL未定";meta.append(path);
      const purpose=document.createElement("p");purpose.textContent=node.purpose||"役割を打ち合わせで確認";
      const actions=document.createElement("div");actions.className="directory-actions";actions.innerHTML='<button type="button" data-action="add-child" title="子ページを追加">＋子</button><button type="button" data-action="wireframe-page" title="ワイヤーフレームを開く">WF</button><button type="button" data-action="edit-page" title="編集">編集</button><button type="button" data-action="delete-page" title="削除">×</button>';
      details.append(meta,purpose,actions);row.append(details);tbody.append(row);
      (node.children||[]).forEach(child=>appendPage(child,depth+1));
    };
    state.pages.forEach(page=>appendPage(page,0));table.append(tbody);map.append(table);
  }
  function clearDropTargets(){$$(".drop-before,.drop-after,.drop-child,.drop-vertical").forEach(item=>{item.classList.remove("drop-before","drop-after","drop-child","drop-vertical");delete item.dataset.dropMode})}
  function beginPointerDrag(e,page,li,card){if(e.button!==0||e.target.closest("button,input,textarea,select"))return;pointerDrag={id:page.id,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,li,card,active:false,targetId:"",mode:""};card.setPointerCapture?.(e.pointerId)}
  function updatePointerDrag(e){if(!pointerDrag)return;pointerDrag.x=e.clientX;pointerDrag.y=e.clientY;if(!pointerDrag.active&&Math.hypot(e.clientX-pointerDrag.startX,e.clientY-pointerDrag.startY)<8)return;if(!pointerDrag.active){pointerDrag.active=true;draggedId=pointerDrag.id;pointerDrag.li.classList.add("dragging");document.body.classList.add("tree-dragging");const ghost=document.createElement("div");ghost.className="tree-drag-ghost";ghost.textContent=$("h3",pointerDrag.card)?.textContent||"ページを移動";document.body.append(ghost);pointerDrag.ghost=ghost}e.preventDefault();pointerDrag.ghost.style.transform=`translate(${e.clientX+14}px,${e.clientY+14}px)`;const targetCard=document.elementFromPoint(e.clientX,e.clientY)?.closest(".page-card"),targetLi=targetCard?.closest(".map-node"),targetId=targetLi?.dataset.id;if(!targetCard||!targetId||targetId===pointerDrag.id){clearDropTargets();pointerDrag.targetId="";return}const rect=targetCard.getBoundingClientRect(),siblings=[...targetLi.parentElement.children].filter(item=>item.classList.contains("map-node")),centers=siblings.map(item=>{const card=$(":scope > .page-card",item),box=card.getBoundingClientRect();return{x:box.left+box.width/2,y:box.top+box.height/2}}),xSpread=Math.max(...centers.map(point=>point.x))-Math.min(...centers.map(point=>point.x)),ySpread=Math.max(...centers.map(point=>point.y))-Math.min(...centers.map(point=>point.y)),vertical=siblings.length>1&&ySpread>xSpread,ratio=vertical?(e.clientY-rect.top)/rect.height:(e.clientX-rect.left)/rect.width,mode=ratio<.28?"before":ratio>.72?"after":"child";clearDropTargets();targetLi.dataset.dropMode=mode;targetLi.classList.toggle("drop-vertical",vertical);targetLi.classList.add(`drop-${mode}`);pointerDrag.targetId=targetId;pointerDrag.mode=mode}
  function finishPointerDrag(e){if(!pointerDrag)return;const current=pointerDrag,shouldMove=current.active&&current.targetId;current.ghost?.remove();current.li.classList.remove("dragging");document.body.classList.remove("tree-dragging");clearDropTargets();pointerDrag=null;draggedId=null;if(shouldMove){e.preventDefault();movePage(current.id,current.targetId,current.mode)}}
  document.addEventListener("pointermove",updatePointerDrag,{passive:false});document.addEventListener("pointerup",finishPointerDrag);document.addEventListener("pointercancel",finishPointerDrag);
  function createNode(page){const frag=$("#pageTemplate").content.cloneNode(true),li=$(".map-node",frag),card=$(".page-card",frag);li.dataset.id=page.id;const status=$(".status",card);status.className=`status ${page.status}`;status.textContent={confirmed:"確定",pending:"要確認",proposed:"提案"}[page.status];const priority=$(".priority",card);priority.className=`priority ${page.priority}`;priority.textContent={high:"優先度 高",normal:"優先度 中",low:"優先度 低"}[page.priority];$("h3",card).textContent=page.name;$("code",card).textContent=page.path||"URL未定";$("p",card).textContent=page.purpose||"役割を打ち合わせで確認";const children=$(".map-children",frag),childCount=(page.children||[]).length;children.dataset.count=childCount;children.style.setProperty("--line-columns",Math.min(childCount,6));(page.children||[]).forEach(c=>children.append(createNode(c)));if(!childCount)children.remove();card.addEventListener("dblclick",()=>openPage(page.id));card.addEventListener("pointerdown",e=>beginPointerDrag(e,page,li,card));return li}
  function renderNotes(){["question","decision","task"].forEach(type=>{const list=$("#"+type+"List");list.replaceChildren();const notes=state.notes.filter(n=>n.type===type);$(`[data-empty="${type}"]`).hidden=!!notes.length;notes.forEach(note=>{const item=document.createElement("div");item.className=`note-item${note.done?" completed":""}`;item.dataset.id=note.id;item.innerHTML=`<input type="checkbox" aria-label="完了"><div class="note-body"><strong></strong><div class="note-meta"></div></div><button class="note-delete" type="button" aria-label="削除">×</button>`;$("strong",item).textContent=note.text;$("input",item).checked=note.done;const bits=[];if(note.owner)bits.push("担当: "+note.owner);if(note.due)bits.push("期限: "+note.due);$(".note-meta",item).textContent=bits.join("  /  ");$("input",item).addEventListener("change",e=>{note.done=e.target.checked;save();renderNotes();updateProgress()});$("strong",item).addEventListener("dblclick",()=>openNote(type,note.id));$(".note-delete",item).addEventListener("click",()=>{state.notes=state.notes.filter(n=>n.id!==note.id);commit("項目を削除しました")});list.append(item)})})}
  const wireDefaults={hero:["メインビジュアル","ページの要点と訪問者にとっての価値を最初に伝える"],intro:["概要・紹介","このページで伝えたい背景や概要を分かりやすく説明する"],imageText:["画像と文章","写真や図を使いながら、内容を具体的に紹介する"],features:["特徴・強み","重要なポイントを3つに整理して伝える"],cards:["一覧・コンテンツ","関連する情報をカード形式で見やすく並べる"],faq:["よくある質問","検討時に生まれる疑問や不安を解消する"],form:["入力フォーム","必要な情報を入力してもらう"],cta:["次の行動へ","相談・問い合わせなど次の行動を案内する"],footer:["フッター","補助ナビゲーションと会社情報を掲載する"]};
  function makeWireBlock(type,title="",text=""){const preset=wireDefaults[type]||wireDefaults.intro;return{id:uid("w"),type,title:title||preset[0],text:text||preset[1]}}
  function sitemapSectionsFor(page){
    if((page.children||[]).length)return page.children;
    if(page.path==="/"||/ホーム|HOME|トップ/i.test(page.name||"")){
      const root=state.pages[0],siblings=root?.children||[];
      return siblings.filter(item=>item.id!==page.id);
    }
    return [];
  }
  function makeSitemapGrid(pages){return{id:uid("w"),type:"sitemapGrid",title:"サイト構成",text:"サイトマップで決めたページ構成と階層",sourcePageIds:pages.map(page=>page.id)}}
  function initialWireframe(page){const name=page.name||"ページ",purpose=page.purpose||state.meta.goal||"このページの役割と伝える内容を確認する",sitemapSections=sitemapSectionsFor(page);if(sitemapSections.length)return[makeWireBlock("hero",name,purpose),makeSitemapGrid(sitemapSections),makeWireBlock("cta"),makeWireBlock("footer")];if(/問合|申込|相談|フォーム|contact/i.test(name+page.path))return[makeWireBlock("hero",name,purpose),makeWireBlock("intro","お問い合わせについて","送信後の流れや対応時間を案内する"),makeWireBlock("form","お問い合わせ内容","必要な項目を過不足なく入力してもらう"),makeWireBlock("faq"),makeWireBlock("footer")];if(/事例|実績|お知らせ|ニュース|一覧|works|case|news/i.test(name+page.path))return[makeWireBlock("hero",name,purpose),makeWireBlock("cards",`${name}の一覧`,"比較・選択しやすい単位で情報を並べる"),makeWireBlock("cta"),makeWireBlock("footer")];return[makeWireBlock("hero",name,purpose),makeWireBlock("intro",`${name}について`,purpose),makeWireBlock("imageText"),makeWireBlock("features"),makeWireBlock("cta"),makeWireBlock("footer")]}
  function ensureAllWireframes(){
    state.pages.forEach(rootPage=>rebaseSubtreePaths(rootPage,"/"));
    const liveIds=new Set();
    walk().forEach(({node})=>{
      liveIds.add(node.id);
      if(!state.wireframeInitialized[node.id]){
        if(!Array.isArray(state.wireframes[node.id])||!state.wireframes[node.id].length)state.wireframes[node.id]=initialWireframe(node);
        state.wireframeInitialized[node.id]=true;
        state.wireframeCustomized[node.id]=false;
      }else if(!state.wireframeCustomized[node.id]){
        state.wireframes[node.id]=initialWireframe(node);
      }
    });
    Object.keys(state.wireframes).forEach(id=>{if(!liveIds.has(id))delete state.wireframes[id]});
    Object.keys(state.wireframeInitialized).forEach(id=>{if(!liveIds.has(id))delete state.wireframeInitialized[id]});
    Object.keys(state.wireframeCustomized).forEach(id=>{if(!liveIds.has(id))delete state.wireframeCustomized[id]});
  }
  function wireSitemapDescendants(nodes){if(!nodes?.length)return"";return`<ul>${nodes.map(node=>`<li><span>${esc(node.name)}</span><small>${esc(node.path||"URL未定")}</small>${wireSitemapDescendants(node.children||[])}</li>`).join("")}</ul>`}
  function wireSitemapColumn(page){return`<article class="wire-sitemap-column"><div class="wire-placeholder">PAGE / CONTENT</div><small>${esc(page.path||"URL未定")}</small><h3>${esc(page.name)}</h3><p>${esc(page.purpose||"役割を打ち合わせで確認")}</p>${wireSitemapDescendants(page.children||[])}<span class="wire-button">${esc(page.name)}を見る</span></article>`}
  function wireNavigationPages(){
    const root=state.pages[0],primary=root?.children?.length?root.children:state.pages,seen=new Set(),result=[];
    const add=page=>{if(page&&!seen.has(page.id)){seen.add(page.id);result.push(page)}};
    primary.filter(page=>/^(HOME|ホーム|トップ)$/i.test(page.name||"")||page.path==="/"||page.nav).forEach(add);
    walk().filter(({node})=>node.nav).forEach(({node})=>add(node));
    if(!result.some(page=>/^(HOME|ホーム|トップ)$/i.test(page.name||"")||page.path==="/"))add(root);
    return result.slice(0,6);
  }
  function wireFooterBody(block){
    const defaultTitle=wireDefaults.footer[0],defaultText=wireDefaults.footer[1],brand=block.customized&&block.title!==defaultTitle?block.title:(state.meta.client||state.meta.project||"SITE NAME"),defaultPages=wireNavigationPages();
    const customLabels=block.customized&&block.text!==defaultText?block.text.split(/[\n、,]+/).map(value=>value.trim()).filter(Boolean):[];
    const items=customLabels.length?customLabels.map(label=>({name:label,path:""})):defaultPages;
    return`<div class="wire-footer-brand"><strong>${esc(brand)}</strong><small>${esc(state.meta.project||"WEBSITE")}</small></div><nav class="wire-footer-menu">${items.map(item=>`<span><strong>${esc(item.name)}</strong><small>${esc(item.path||"")}</small></span>`).join("")}</nav><span class="wire-footer-cta">${esc(state.meta.action||"お問い合わせ")}</span>`;
  }
  function wireImagePlaceholder(block,slot,label){const src=block.images?.[slot],style=src?` style="background-image:linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),url('${esc(src)}')"`:"";return`<div class="wire-placeholder wire-image-picker${src?" has-image":""}" data-wire-image-slot="${esc(slot)}" tabindex="0" role="button" aria-label="${src?"画像を変更":"画像を追加"}"${style}><strong>${src?esc(label):`＋ ${esc(label)}`}</strong><span>${src?"クリックして変更":"クリックして画像を追加"}</span></div>`}
  function wireBlockBody(block,page){const title=block.type==="hero"?page.name:block.title,text=block.type==="hero"?(page.purpose||block.text):block.text;const lines='<div class="wire-lines"><i></i><i></i><i></i></div>';if(block.type==="sitemapGrid"){const pages=(block.sourcePageIds||[]).map(id=>findPage(id)?.node).filter(Boolean),columns=Math.min(4,Math.max(1,pages.length));return`<div class="wire-sitemap-grid-head"><h3>${esc(title)}</h3><p>${esc(text)}</p></div><div class="wire-sitemap-grid" style="--wire-columns:${columns}">${pages.map(wireSitemapColumn).join("")}</div>`}if(block.type==="sitemapPage"){const source=findPage(block.sourcePageId)?.node;return`<div class="wire-sitemap-page"><div><small>${esc(source?.path||"URL未定")}</small><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="wire-button">${esc(title)}を見る</span></div>${wireImagePlaceholder(block,"main","IMAGE / CONTENT")}</div>`}if(block.type==="hero")return`<div class="wire-hero"><div class="wire-hero-copy"><small>${esc(page.path||"PAGE")}</small><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="wire-button">詳しく見る</span></div>${wireImagePlaceholder(block,"main","KEY VISUAL / IMAGE")}</div>`;if(block.type==="imageText")return`<div class="wire-columns">${wireImagePlaceholder(block,"main","IMAGE / PHOTO")}<div><h3>${esc(title)}</h3><p>${esc(text)}</p>${lines}</div></div>`;if(block.type==="features"||block.type==="cards")return`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="wire-card-grid">${[1,2,3].map(n=>`<div class="wire-card">${block.type==="cards"?wireImagePlaceholder(block,`card-${n}`,"IMAGE"):""}<strong>項目 ${n}</strong><i></i><i></i></div>`).join("")}</div>`;if(block.type==="faq")return`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="wire-faq"><div>Q. よくある質問を入力</div><div>Q. よくある質問を入力</div><div>Q. よくある質問を入力</div></div>`;if(block.type==="form")return`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="wire-form"><div class="wire-field">お名前</div><div class="wire-field">メールアドレス</div><div class="wire-field wide">お問い合わせ内容</div></div><span class="wire-button">送信内容を確認する</span>`;if(block.type==="cta")return`<h3>${esc(title)}</h3><p>${esc(text)}</p><span class="wire-button">${esc(state.meta.action||"お問い合わせはこちら")}</span>`;if(block.type==="footer")return wireFooterBody(block);return`<h3>${esc(title)}</h3><p>${esc(text)}</p>${lines}`}
  function wireBlockHtml(block,page,index,count){const label={hero:"HERO",sitemapGrid:"SITEMAP COLUMNS",sitemapPage:"SITEMAP PAGE",intro:"TEXT",imageText:"IMAGE + TEXT",features:"FEATURES",cards:"CARDS",faq:"FAQ",form:"FORM",cta:"CTA",footer:"FOOTER"}[block.type]||"BLOCK",height=block.heights?.[state.wireDevice],style=height?` style="min-height:${Math.round(height)}px"`:"";return`<section class="wire-block ${block.type==="sitemapGrid"?"wire-sitemap-grid-block":""} ${block.type==="sitemapPage"?"wire-sitemap-block":""} ${block.type==="cta"?"wire-cta":""} ${block.type==="footer"?"wire-footer-preview":""}" data-wire-block-id="${block.id}"${style}><span class="wire-block-tag">${label}</span><div class="wire-block-controls"><button type="button" data-wire-action="up" ${index===0?"disabled":""} title="上へ">↑</button><button type="button" data-wire-action="down" ${index===count-1?"disabled":""} title="下へ">↓</button><button type="button" data-wire-action="edit" title="編集">編集</button><button type="button" data-wire-action="delete" title="削除">×</button></div>${wireBlockBody(block,page)}<button class="wire-resize-handle" type="button" title="ドラッグで高さ変更・ダブルクリックで元に戻す" aria-label="ブロックの高さを変更"><i></i></button></section>`}
  function renderWireframe(){const all=walk(),select=$("#wireframePageSelect"),canvas=$("#wireframeCanvas"),summary=$("#wireframePageSummary");if(!all.some(x=>x.node.id===state.selectedWireframePageId))state.selectedWireframePageId=all[0]?.node.id||"";select.replaceChildren();all.forEach(({node,depth})=>{const option=document.createElement("option");option.value=node.id;option.textContent=`${"　".repeat(depth)}${depth?"└ ":""}${node.name}`;select.append(option)});select.value=state.selectedWireframePageId;select.disabled=!all.length;$("#generateWireframeBtn").disabled=!all.length;canvas.className=`wireframe-frame ${state.wireDevice} mood-${state.wireMood}`;$$('[data-wire-device]').forEach(button=>button.classList.toggle("active",button.dataset.wireDevice===state.wireDevice));$$('[data-wire-mood]').forEach(button=>button.classList.toggle("active",button.dataset.wireMood===state.wireMood));if(!all.length){summary.textContent="サイトマップにページを追加すると、ここでデザインラフを作成できます。";canvas.innerHTML='<div class="wire-empty"><span>＋</span><strong>ページがありません</strong><p>先にサイトマップでページ構成を作成してください。</p></div>';return}const page=findPage(state.selectedWireframePageId)?.node,blocks=state.wireframes[page.id]||[];summary.innerHTML=`<strong>${esc(page.name)}</strong><code>${esc(page.path||"URL未定")}</code><span>${esc(page.purpose||"役割を打ち合わせで確認")}</span><em>${{trust:"信頼感のある落ち着いた印象",friendly:"親しみやすく柔らかな印象",modern:"シャープで洗練された印象"}[state.wireMood]}</em>`;if(!blocks.length){canvas.innerHTML='<div class="wire-empty"><span>▦</span><strong>ブロックがありません</strong><p>左側のブロックを追加するか、「サイトマップから再作成」で構成を復元できます。</p></div>';return}const nav=wireNavigationPages().map(node=>`<span>${esc(node.name)}</span>`).join("");const header=`<header class="wire-site-header"><div class="wire-logo">${esc(state.meta.client||state.meta.project||"SITE NAME")}<small>${esc(state.meta.project||"WEBSITE")}</small></div><nav class="wire-nav">${nav}</nav><span class="wire-header-cta">${esc(state.meta.action||"お問い合わせ")}</span></header>`;canvas.innerHTML=header+blocks.map((block,index)=>wireBlockHtml(block,page,index,blocks.length)).join("")}
  function openWireBlock(id){const block=(state.wireframes[state.selectedWireframePageId]||[]).find(item=>item.id===id);if(!block)return;const footer=block.type==="footer";$("#editingWireBlockId").value=id;$("#wireBlockTitle").value=block.title;$("#wireBlockText").value=block.text;$("#wireBlockTitleLabel").textContent=footer?"フッター名（変更する場合）":"見出し";$("#wireBlockTextLabel").textContent=footer?"独自メニュー（改行・読点区切り）":"説明";$("#wireBlockTitle").placeholder=footer?"空欄ならサイト名を使用":"例：私たちが選ばれる理由";$("#wireBlockText").placeholder=footer?"例：HOME、会社案内、採用情報":"このブロックで伝える内容";$("#wireBlockDialog").showModal();setTimeout(()=>$("#wireBlockTitle").focus(),50)}
  function selectWireframePage(id){if(!findPage(id))return;state.selectedWireframePageId=id;save();renderWireframe();$("#wireframe").scrollIntoView({behavior:"smooth",block:"start"})}
  function beginWireResize(event){const handle=event.target.closest(".wire-resize-handle"),element=handle?.closest(".wire-block");if(!handle||!element)return;event.preventDefault();wireResize={id:element.dataset.wireBlockId,element,startY:event.clientY,startHeight:element.getBoundingClientRect().height};document.body.classList.add("wire-resizing");handle.setPointerCapture?.(event.pointerId)}
  function updateWireResize(event){if(!wireResize)return;event.preventDefault();const height=Math.max(120,Math.min(1000,wireResize.startHeight+event.clientY-wireResize.startY));wireResize.element.style.minHeight=`${Math.round(height)}px`}
  function finishWireResize(){if(!wireResize)return;const block=(state.wireframes[state.selectedWireframePageId]||[]).find(item=>item.id===wireResize.id);if(block){block.heights||={};block.heights[state.wireDevice]=Math.round(wireResize.element.getBoundingClientRect().height);state.wireframeCustomized[state.selectedWireframePageId]=true;save();toast("ブロックの高さを保存しました")}wireResize=null;document.body.classList.remove("wire-resizing")}
  function resetWireHeight(event){const handle=event.target.closest(".wire-resize-handle"),id=handle?.closest(".wire-block")?.dataset.wireBlockId,block=(state.wireframes[state.selectedWireframePageId]||[]).find(item=>item.id===id);if(!block?.heights)return;delete block.heights[state.wireDevice];save();renderWireframe();toast("ブロックの高さを元に戻しました")}
  function compressWireImage(file){return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{const limit=1600,scale=Math.min(1,limit/Math.max(image.width,image.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL("image/jpeg",.8))};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("image"))};image.src=url})}
  function chooseWireImage(event){const picker=event.target.closest(".wire-image-picker"),blockElement=picker?.closest(".wire-block");if(!picker||!blockElement)return;pendingWireImage={pageId:state.selectedWireframePageId,blockId:blockElement.dataset.wireBlockId,slot:picker.dataset.wireImageSlot};$("#wireImageInput").click()}
  function openPage(id="",parentId=""){const p=id?findPage(id)?.node:null;$("#pageDialogTitle").textContent=p?"ページを編集":"ページを追加";$("#editingPageId").value=p?.id||"";$("#newParentId").value=parentId;$("#pageName").value=p?.name||"";$("#pagePath").value=p?.path||"";$("#pageStatus").value=p?.status||"proposed";$("#pagePurpose").value=p?.purpose||"";$("#pagePriority").value=p?.priority||"normal";$("#pageNav").checked=!!p?.nav;$("#pageDialog").showModal();setTimeout(()=>$("#pageName").focus(),50)}
  function openNote(type,id=""){const n=id?state.notes.find(x=>x.id===id):null;$("#noteType").value=type;$("#editingNoteId").value=id;$("#noteDialogTitle").textContent={question:"確認事項",decision:"決定事項",task:"次回までの宿題"}[type]+(n?"を編集":"を追加");$("#noteText").value=n?.text||"";$("#noteOwner").value=n?.owner||"";$("#noteDue").value=n?.due||"";$("#noteDialog").showModal();setTimeout(()=>$("#noteText").focus(),50)}
  function movePage(sourceId,targetId,mode="child"){
    if(!sourceId||!targetId||sourceId===targetId)return;
    const s=findPage(sourceId),t=findPage(targetId),targetEntry=walk().find(item=>item.node.id===targetId);
    if(!s||!t||includes(s.node,targetId)){toast("その位置には移動できません");return}
    const moved=s.node,destinationParentPath=mode==="child"?t.node.path:(targetEntry?.parent?.path||"/");
    s.nodes.splice(s.index,1);
    if(mode==="child"){
      t.node.children=t.node.children||[];
      t.node.children.push(moved);
      rebaseSubtreePaths(moved,destinationParentPath);
      commit(`「${t.node.name}」の子ページへ移動し、URLも更新しました`);
      return;
    }
    let insertAt=t.index+(mode==="after"?1:0);
    if(s.nodes===t.nodes&&s.index<t.index)insertAt--;
    t.nodes.splice(Math.max(0,insertAt),0,moved);
    rebaseSubtreePaths(moved,destinationParentPath);
    commit(`「${t.node.name}」の${mode==="before"?"前":"後"}へ移動し、URLも更新しました`);
  }
  function commit(message){ensureAllWireframes();save();render();toast(message);scheduleTreeConnectors()}
  function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2100)}
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
  function meetingRecordFilename(){
    const client=String(state.meta.client||"クライアント名未入力").trim().replace(/[\\/:*?"<>|]/g,"-")||"クライアント名未入力";
    const date=String(state.meta.date||new Date().toISOString().slice(0,10)).replace(/\D/g,"")||new Date().toISOString().slice(0,10).replace(/-/g,"");
    return `${client}${date}打合せ記録.html`;
  }
  async function exportPdf(){
    const button=$("#printBtn"),originalText=button.textContent;
    if(!window.html2canvas||!window.jspdf?.jsPDF){toast("PDF機能を読み込めませんでした");return}
    button.disabled=true;button.textContent="PDF作成中…";toast("印刷用PDFを作成しています…");
    try{
      let printLayout={height:0,breaks:[],majorBreaks:[],keepRanges:[]};
      const canvas=await window.html2canvas($("main"),{scale:1.25,useCORS:true,backgroundColor:"#fffef9",logging:false,windowWidth:1440,onclone:doc=>{
        doc.body.classList.add("pdf-rendering");
        const root=doc.querySelector("main"),rootBox=root.getBoundingClientRect(),relativeBox=element=>{const box=element.getBoundingClientRect();return{top:box.top-rootBox.top,bottom:box.bottom-rootBox.top,height:box.height}};
        root.offsetHeight;
        const breakSelectors=[".meeting-hero",".section-block",".brief-card",".sitemap-summary",".page-card",".directory-row",".note-panel",".free-memo",".wire-site-header",".wire-block"],keepSelectors=[".meeting-fields",".meeting-title-row",".section-heading",".brief-card",".sitemap-section",".page-card",".directory-row",".note-panel",".free-memo",".wire-site-header",".wire-block"];
        const visible=selector=>[...root.querySelectorAll(selector)].filter(element=>element.getBoundingClientRect().width&&element.getBoundingClientRect().height);
        const breaks=[0,root.scrollHeight];breakSelectors.flatMap(visible).forEach(element=>{const box=relativeBox(element);breaks.push(box.top,box.bottom)});
        const majorBreaks=[0,root.scrollHeight];[...root.querySelectorAll(".meeting-hero,.section-block")].filter(element=>element.getBoundingClientRect().height).forEach(element=>{const box=relativeBox(element);majorBreaks.push(box.top,box.bottom)});
        printLayout={height:root.scrollHeight,breaks:[...new Set(breaks.map(value=>Math.max(0,Math.round(value))))].sort((a,b)=>a-b),majorBreaks:[...new Set(majorBreaks.map(value=>Math.max(0,Math.round(value))))].sort((a,b)=>a-b),keepRanges:keepSelectors.flatMap(visible).map(relativeBox).filter(box=>box.height>8)};
      }});
      const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true}),pageWidth=297,pageHeight=210,margin=8,drawWidth=pageWidth-margin*2,drawHeight=pageHeight-margin*2,sliceHeight=Math.floor(canvas.width*drawHeight/drawWidth);
      const layoutScale=printLayout.height?canvas.height/printLayout.height:1,breaks=printLayout.breaks.map(value=>Math.round(value*layoutScale)),majorBreaks=printLayout.majorBreaks.map(value=>Math.round(value*layoutScale)),keepRanges=printLayout.keepRanges.map(box=>({top:Math.round(box.top*layoutScale),bottom:Math.round(box.bottom*layoutScale)}));
      const findPageEnd=start=>{
        const ideal=Math.min(canvas.height,start+sliceHeight);if(ideal>=canvas.height)return canvas.height;
        const oversized=keepRanges.filter(range=>range.top<=start+8&&range.bottom>ideal&&range.bottom-range.top>sliceHeight).sort((a,b)=>a.top-b.top)[0];
        if(oversized)return oversized.bottom;
        const minimum=start+sliceHeight*.52,candidates=breaks.filter(value=>value>=minimum&&value<=ideal-8),majorCandidates=majorBreaks.filter(value=>value>=start+sliceHeight*.38&&value<=ideal-8);
        let end=majorCandidates.at(-1)||candidates.at(-1)||ideal;
        const crossing=keepRanges.filter(range=>range.top<end&&range.bottom>end).sort((a,b)=>b.top-a.top)[0];
        if(crossing&&crossing.top>start+8)end=crossing.top;
        return Math.max(start+1,Math.round(end));
      };
      let page=0,y=0;const previewPages=[];
      while(y<canvas.height){
        const end=findPageEnd(y),height=end-y,slice=document.createElement("canvas");
        slice.width=canvas.width;slice.height=sliceHeight;
        const context=slice.getContext("2d"),renderHeight=Math.min(height,sliceHeight);context.fillStyle="#fff";context.fillRect(0,0,slice.width,slice.height);context.drawImage(canvas,0,y,canvas.width,height,0,0,canvas.width,renderHeight);
        if(page++)pdf.addPage("a4","landscape");
        const imageData=slice.toDataURL("image/jpeg",.88);previewPages.push(imageData);
        pdf.addImage(imageData,"JPEG",margin,margin,drawWidth,drawHeight,undefined,"FAST");
        pdf.setFontSize(7);pdf.setTextColor(125);pdf.text(`${page}`,pageWidth-margin,pageHeight-3,{align:"right"});
        y=end;
      }
      const filename=String(state.meta.project||"site-meeting").replace(/[\\/:*?"<>|]/g,"-");
      if(pdfObjectUrl)URL.revokeObjectURL(pdfObjectUrl);
      pdfObjectUrl=URL.createObjectURL(pdf.output("blob"));
      $("#pdfPageCount").textContent=`（全${page}ページ）`;
      $("#pdfPreviewPages").innerHTML=previewPages.map((src,index)=>`<figure><img src="${src}" alt="印刷用PDF ${index+1}ページ目のプレビュー"><figcaption>${index+1} / ${page}</figcaption></figure>`).join("");
      $("#pdfDownloadBtn").href=pdfObjectUrl;$("#pdfDownloadBtn").download=`${filename}-サイト設計.pdf`;
      $("#pdfDialog").showModal();toast("印刷用PDFを作成しました");
    }catch(error){console.error(error);toast("PDFを作成できませんでした")}finally{button.disabled=false;button.textContent=originalText}
  }
  function esc(v){return String(v||"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#039;"}[c]))}
  function reportHtml(){const all=walk();const pageRows=all.map(({node,depth})=>`<tr><td style="padding-left:${12+depth*22}px">${depth?"└ ":""}${esc(node.name)}</td><td>${esc(node.path)}</td><td>${{confirmed:"確定",pending:"要確認",proposed:"提案"}[node.status]}</td><td>${esc(node.purpose)}</td></tr>`).join("");const noteGroup=(type,title)=>`<section><h2>${title}</h2><ul>${state.notes.filter(n=>n.type===type).map(n=>`<li>${esc(n.text)} ${n.owner?`<small>担当: ${esc(n.owner)}</small>`:""} ${n.due?`<small>期限: ${esc(n.due)}</small>`:""}</li>`).join("")||"<li>なし</li>"}</ul></section>`;return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(state.meta.project)} 打ち合わせ記録</title><style>body{max-width:1050px;margin:42px auto;padding:0 24px;font-family:system-ui,sans-serif;color:#1e2925}header{border-bottom:4px solid #173f35;padding-bottom:20px}h1{margin:8px 0}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.box{padding:12px;background:#f3f2eb}.brief{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.brief div{padding:16px;border:1px solid #ddd}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}th{background:#eef2ef}section{break-inside:avoid}small{color:#777;margin-left:10px}@media print{@page{size:A4 landscape;margin:10mm}body{margin:0}}</style></head><body><header><small>SITE MEETING REPORT</small><h1>${esc(state.meta.project||"サイト制作")}</h1><div class="meta"><div class="box">CLIENT<br><strong>${esc(state.meta.client)||"未入力"}</strong></div><div class="box">DATE<br><strong>${esc(state.meta.date)||"未入力"}</strong></div><div class="box">PARTICIPANTS<br><strong>${esc(state.meta.participants)||"未入力"}</strong></div><div class="box">SITE TYPE<br><strong>${esc(state.meta.siteType)||"未定"}</strong></div></div></header><div class="brief"><div><strong>目的</strong><p>${esc(state.meta.goal)||"未定"}</p></div><div><strong>ターゲット</strong><p>${esc(state.meta.target)||"未定"}</p></div><div><strong>期待する行動</strong><p>${esc(state.meta.action)||"未定"}</p></div></div><h2>サイトマップ（${all.length}ページ）</h2><table><thead><tr><th>ページ</th><th>URL</th><th>状態</th><th>役割</th></tr></thead><tbody>${pageRows}</tbody></table>${noteGroup("question","確認事項")}${noteGroup("decision","決定事項")}${noteGroup("task","次回までの宿題")}<section><h2>自由メモ</h2><p>${esc(state.meta.memo).replace(/\n/g,"<br>")||"なし"}</p></section></body></html>`}
  ensureAllWireframes();save();bindFields();render();scheduleTreeConnectors();
  $$('[data-map-view]').forEach(button=>button.addEventListener("click",()=>{mapView=button.dataset.mapView;state.mapView=mapView;save();renderMap();scheduleTreeConnectors()}));
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-add-wire-block]"))state.wireframeCustomized[state.selectedWireframePageId]=true;
    const action=e.target.closest("[data-wire-action]")?.dataset.wireAction;
    if(["delete","up","down"].includes(action))state.wireframeCustomized[state.selectedWireframePageId]=true;
  });
  document.addEventListener("click",e=>{const action=e.target.closest("[data-action]");if(action){const id=action.closest("[data-id]")?.dataset.id;if(action.dataset.action==="add-page")openPage();if(action.dataset.action==="add-child")openPage("",id);if(action.dataset.action==="wireframe-page")selectWireframePage(id);if(action.dataset.action==="edit-page")openPage(id);if(action.dataset.action==="delete-page"){const hit=findPage(id);if(hit&&confirm(`「${hit.node.name}」と配下のページを削除しますか？`)){collectPageIds(hit.node).forEach(pageId=>{delete state.wireframes[pageId];delete state.wireframeInitialized[pageId]});hit.nodes.splice(hit.index,1);commit("ページを削除しました")}}}const add=e.target.closest("[data-add-note]");if(add)openNote(add.dataset.addNote);const addWire=e.target.closest("[data-add-wire-block]");if(addWire&&state.selectedWireframePageId){state.wireframes[state.selectedWireframePageId]||=[];state.wireframes[state.selectedWireframePageId].push(makeWireBlock(addWire.dataset.addWireBlock));commit("ワイヤーフレームにブロックを追加しました")}const wireAction=e.target.closest("[data-wire-action]");if(wireAction){const list=state.wireframes[state.selectedWireframePageId]||[],id=wireAction.closest("[data-wire-block-id]")?.dataset.wireBlockId,index=list.findIndex(block=>block.id===id);if(index>=0){if(wireAction.dataset.wireAction==="edit")openWireBlock(id);if(wireAction.dataset.wireAction==="delete"){list.splice(index,1);commit("ブロックを削除しました")}if(wireAction.dataset.wireAction==="up"&&index>0){[list[index-1],list[index]]=[list[index],list[index-1]];commit("ブロックを上へ移動しました")}if(wireAction.dataset.wireAction==="down"&&index<list.length-1){[list[index+1],list[index]]=[list[index],list[index+1]];commit("ブロックを下へ移動しました")}}}const close=e.target.closest("[data-close-dialog]");if(close)$("#"+close.dataset.closeDialog).close()});
  $("#pageForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#editingPageId").value,data={name:$("#pageName").value.trim(),path:$("#pagePath").value.trim(),status:$("#pageStatus").value,purpose:$("#pagePurpose").value.trim(),priority:$("#pagePriority").value,nav:$("#pageNav").checked};if(!data.name)return;if(id)Object.assign(findPage(id).node,data);else{const p={id:uid("p"),...data,children:[]},parentId=$("#newParentId").value;if(parentId)findPage(parentId).node.children.push(p);else state.pages.push(p)}$("#pageDialog").close();commit(id?"ページを更新しました":"ページを追加しました")});
  $("#noteForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#editingNoteId").value,data={text:$("#noteText").value.trim(),owner:$("#noteOwner").value.trim(),due:$("#noteDue").value};if(!data.text)return;if(id)Object.assign(state.notes.find(n=>n.id===id),data);else state.notes.push({id:uid("n"),type:$("#noteType").value,...data,done:false});$("#noteDialog").close();commit(id?"内容を更新しました":"項目を追加しました")});
  $("#wireBlockForm").addEventListener("submit",e=>{e.preventDefault();const block=(state.wireframes[state.selectedWireframePageId]||[]).find(item=>item.id===$("#editingWireBlockId").value);if(!block)return;block.title=$("#wireBlockTitle").value.trim()||wireDefaults[block.type]?.[0]||"コンテンツ";block.text=$("#wireBlockText").value.trim();block.customized=true;state.wireframeCustomized[state.selectedWireframePageId]=true;$("#wireBlockDialog").close();commit("ブロックの内容を更新しました")});
  $("#wireframePageSelect").addEventListener("change",e=>{state.selectedWireframePageId=e.target.value;save();renderWireframe()});
  $$('[data-wire-device]').forEach(button=>button.addEventListener("click",()=>{state.wireDevice=button.dataset.wireDevice;save();renderWireframe()}));
  $$('[data-wire-mood]').forEach(button=>button.addEventListener("click",()=>{state.wireMood=button.dataset.wireMood;save();renderWireframe()}));
  document.addEventListener("pointerdown",beginWireResize);
  document.addEventListener("pointermove",updateWireResize,{passive:false});
  document.addEventListener("pointerup",finishWireResize);
  document.addEventListener("pointercancel",finishWireResize);
  document.addEventListener("dblclick",event=>{if(event.target.closest(".wire-resize-handle"))resetWireHeight(event)});
  document.addEventListener("click",event=>{if(event.target.closest(".wire-image-picker"))chooseWireImage(event)});
  document.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.closest(".wire-image-picker")){event.preventDefault();chooseWireImage(event)}});
  $("#wireImageInput").addEventListener("change",async event=>{const file=event.target.files[0],target=pendingWireImage;event.target.value="";pendingWireImage=null;if(!file||!target)return;try{const block=(state.wireframes[target.pageId]||[]).find(item=>item.id===target.blockId);if(!block)return;block.images||={};block.images[target.slot]=await compressWireImage(file);state.wireframeCustomized[target.pageId]=true;save();renderWireframe();toast("画像を追加しました")}catch{toast("画像を追加できませんでした")}});
  $("#generateWireframeBtn").addEventListener("click",()=>{const page=findPage(state.selectedWireframePageId)?.node;if(!page)return;const current=state.wireframes[page.id]||[];if(current.length&&!confirm("現在のカスタマイズを消して、サイトマップから構成を作り直しますか？"))return;state.wireframeCustomized[page.id]=false;state.wireframes[page.id]=initialWireframe(page);commit(`「${page.name}」へサイトマップを反映しました`)});
  $("#addPageBtn").addEventListener("click",()=>openPage());$("#starterBtn").addEventListener("click",()=>$("#starterDialog").showModal());$$('[data-starter]').forEach(btn=>btn.addEventListener("click",()=>{if(!confirm("現在のページ構成を選択したひな形に置き換えますか？"))return;state.pages=starters[btn.dataset.starter]();state.wireframes={};state.wireframeInitialized={};state.wireframeCustomized={};state.selectedWireframePageId="";$("#starterDialog").close();commit("ひな形と全ページのワイヤーフレームを作成しました")}));
  $$('[data-scroll]').forEach(btn=>btn.addEventListener("click",()=>{$$('[data-scroll]').forEach(b=>b.classList.toggle("active",b===btn));$("#"+btn.dataset.scroll).scrollIntoView({behavior:"smooth",block:"start"})}));
  $("#printBtn").addEventListener("click",exportPdf);$("#reportBtn").addEventListener("click",()=>{download(meetingRecordFilename(),reportHtml(),"text/html");toast("打合せ記録を保存しました")});$("#dataBtn").addEventListener("click",()=>$("#dataDialog").showModal());
  $("#exportDataBtn").addEventListener("click",()=>{download(`${state.meta.project||"site-meeting"}-編集データ.json`,JSON.stringify(state,null,2),"application/json");toast("編集データを保存しました")});$("#importDataBtn").addEventListener("click",()=>$("#fileInput").click());$("#fileInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const next=JSON.parse(await file.text());if(!next.meta||!Array.isArray(next.pages)||!Array.isArray(next.notes))throw new Error();state=next;save();location.reload()}catch{toast("対応する編集データではありません")}e.target.value=""});$("#resetBtn").addEventListener("click",()=>{if(!confirm("現在の内容を消して、新しい打ち合わせを始めますか？"))return;state=defaults();save();location.reload()});
  document.addEventListener("click",e=>{
    const action=e.target.closest('[data-action="add-child"]');
    if(!action)return;
    const parentId=action.closest("[data-id]")?.dataset.id;
    if(parentId&&!$("#editingPageId").value)$("#pagePath").value=inheritedChildPath(parentId);
  });
  window.addEventListener("resize",scheduleTreeConnectors);
})();
