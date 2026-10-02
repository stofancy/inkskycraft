/** 成长页直接展示正式的 64 像素天赋图。 */
export function passivePreview(_kind:string,icon:string):string {
 return `<div class="passive-preview"><img src="${icon}" width="64" height="64" alt="天赋图标" style="width:64px;height:64px;object-fit:contain;margin:30px auto;display:block"></div>`;
}
