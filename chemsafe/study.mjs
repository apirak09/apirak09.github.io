// Read-only selectors for quick review. These never record an answer or advance a round.
export const normalizeKeyword=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('th').replace(/[\s\u200b-\u200d\ufeff]/gu,'');
const words=query=>String(query??'').trim().split(/\s+/u).filter(Boolean);
export function studyMatches(q,progress,filter={}){
 const text=normalizeKeyword(q.id+' '+q.question+(filter.scope==='all'?' '+q.options.join(' '):''));
 if(!words(filter.query).every(word=>text.includes(normalizeKeyword(word))))return false;
 if(filter.category&&filter.category!=='all'&&q.category!==filter.category)return false;
 const stat=progress.stats[q.id];
 return !filter.status||filter.status==='all'||filter.status==='weak'&&stat?.lastCorrect===false||filter.status==='unseen'&&!stat?.attempts||filter.status==='bookmarks'&&progress.bookmarks.includes(q.id)||filter.status==='revised'&&!!q.revised;
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function highlightKeywords(value,query){
 const text=String(value),terms=[...new Set(words(query))].sort((a,b)=>b.length-a.length);
 if(!terms.length)return escapeHtml(text);
 const pattern=terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
 const expression=new RegExp(pattern,'giu');let result='',last=0;
 for(const match of text.matchAll(expression)){result+=escapeHtml(text.slice(last,match.index))+'<mark>'+escapeHtml(match[0])+'</mark>';last=match.index+match[0].length;}
 return result+escapeHtml(text.slice(last));
}
