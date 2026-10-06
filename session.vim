let SessionLoad = 1
let s:so_save = &g:so | let s:siso_save = &g:siso | setg so=0 siso=0 | setl so=-1 siso=-1
let v:this_session=expand("<sfile>:p")
doautoall SessionLoadPre
silent only
silent tabonly
cd ~/Developer/Work/personalWork/websites/inquirely
if expand('%') == '' && !&modified && line('$') <= 1 && getline(1) == ''
  let s:wipebuf = bufnr('%')
endif
let s:shortmess_save = &shortmess
set shortmess+=aoO
badd +92 ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.ts
badd +262 ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.bak.ts
badd +58 lib/builder/store.ts
badd +27 app/layout.tsx
badd +33 lib/forms/operations.ts
badd +44 app/(dashboard)/layout.tsx
badd +74 .next/dev/types/routes.d.ts
badd +35 app/api/ai/generate-form/route.ts
badd +39 lib/ai/schemas/index.ts
badd +201 lib/forms/schema.ts
badd +2 app/(dashboard)/settings/page.tsx
badd +4 app/f/\[slug]/layout.tsx
badd +1 app/f/\[slug]/not-found.tsx
badd +20 app/f/\[slug]/page.tsx
badd +13 app/(dashboard)/forms/page.tsx
badd +75 app/(dashboard)/forms/\[id]/responses/page.tsx
badd +32 lib/db/schema/forms.ts
badd +108 lib/db/forms/forms.ts
badd +0 ~/Developer/Work/personalWork/websites/inquirely/lib/__test__/ai/generate-form.test.ts
badd +18 lib/ai/graphs/generate-form/nodes/understand-intent.ts
badd +118 node_modules/.pnpm/@langchain+core@1.2.14/node_modules/@langchain/core/dist/language_models/chat_models.d.ts
badd +5 lib/ai/graphs/generate-form/schema.ts
badd +57 lib/ai/graphs/generate-form/nodes/generate-blocks.ts
badd +189 ~/Developer/Work/personalWork/websites/inquirely/node_modules/.pnpm/@langchain+core@1.2.14/node_modules/@langchain/core/dist/messages/base.d.ts
badd +20 ~/Developer/Work/personalWork/websites/inquirely/node_modules/.pnpm/@langchain+core@1.2.14/node_modules/@langchain/core/dist/messages/message.d.ts
badd +14 ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/nodes/validate-node.ts
badd +48 ~/Developer/Work/personalWork/websites/inquirely/lib/forms/validate-definition.ts
badd +36 lib/ai/graphs/generate-form/nodes/improve-wording.ts
badd +99 lib/ai/graphs/generate-form/TEMPLATE.bak.ts
argglobal
%argdel
edit lib/ai/graphs/generate-form/schema.ts
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd _ | wincmd |
split
1wincmd k
wincmd w
wincmd w
let &splitbelow = s:save_splitbelow
let &splitright = s:save_splitright
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
exe '1resize ' . ((&lines * 30 + 31) / 62)
exe 'vert 1resize ' . ((&columns * 98 + 99) / 198)
exe '2resize ' . ((&lines * 29 + 31) / 62)
exe 'vert 2resize ' . ((&columns * 98 + 99) / 198)
exe 'vert 3resize ' . ((&columns * 99 + 99) / 198)
argglobal
balt lib/ai/graphs/generate-form/nodes/improve-wording.ts
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
silent! normal! zE
let &fdl = &fdl
let s:l = 5 - ((4 * winheight(0) + 15) / 30)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 5
normal! 07|
wincmd w
argglobal
if bufexists(fnamemodify("~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.ts", ":p")) | buffer ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.ts | else | edit ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.ts | endif
if &buftype ==# 'terminal'
  silent file ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.ts
endif
balt ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.bak.ts
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
silent! normal! zE
let &fdl = &fdl
let s:l = 92 - ((25 * winheight(0) + 14) / 29)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 92
normal! 044|
wincmd w
argglobal
if bufexists(fnamemodify("lib/ai/graphs/generate-form/TEMPLATE.bak.ts", ":p")) | buffer lib/ai/graphs/generate-form/TEMPLATE.bak.ts | else | edit lib/ai/graphs/generate-form/TEMPLATE.bak.ts | endif
if &buftype ==# 'terminal'
  silent file lib/ai/graphs/generate-form/TEMPLATE.bak.ts
endif
balt ~/Developer/Work/personalWork/websites/inquirely/lib/ai/graphs/generate-form/generate-form.bak.ts
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
silent! normal! zE
let &fdl = &fdl
let s:l = 99 - ((29 * winheight(0) + 30) / 60)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 99
normal! 0
wincmd w
3wincmd w
exe '1resize ' . ((&lines * 30 + 31) / 62)
exe 'vert 1resize ' . ((&columns * 98 + 99) / 198)
exe '2resize ' . ((&lines * 29 + 31) / 62)
exe 'vert 2resize ' . ((&columns * 98 + 99) / 198)
exe 'vert 3resize ' . ((&columns * 99 + 99) / 198)
tabnext 1
if exists('s:wipebuf') && len(win_findbuf(s:wipebuf)) == 0 && getbufvar(s:wipebuf, '&buftype') isnot# 'terminal'
  silent exe 'bwipe ' . s:wipebuf
endif
unlet! s:wipebuf
set winheight=1 winwidth=20
let &shortmess = s:shortmess_save
let &winminheight = s:save_winminheight
let &winminwidth = s:save_winminwidth
let s:sx = expand("<sfile>:p:r")."x.vim"
if filereadable(s:sx)
  exe "source " . fnameescape(s:sx)
endif
let &g:so = s:so_save | let &g:siso = s:siso_save
set hlsearch
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
