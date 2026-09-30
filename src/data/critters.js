// Garip yaratıklar: haritada gizli oyuklarda uyur; bulunca yoldaş olur, koleksiyona girer.
// art: 14x11 piksel, sağa bakar; a ana renk, b açık, c koyu, x vurgu, e göz parıltısı, k göz bebeği, p yanak, w beyaz, . boş.
// min: en erken biyom, w: bulunma ağırlığı.
export const CRITTERS = {
  tavsan: { name: 'Tünel Tavşanı', min: 0, w: 10, pal: { a: '#a07850', b: '#e0c49c', c: '#6a4a2a', x: '#f0a0b0' }, lore: 'Kulakları yer altı rüzgârını duyar.',
    art: ['........aa.aa.', '........ax.ax.', '........ax.ax.', '.......aaaaaaa', '.......abbekba', '..bb...abbkkbx', '.bbbb.aabpbbba', '.bbaaaaaaaabb.', '..aaabbbbbaaa.', '..aaabbbbbaaa.', '...cc.....cc..'] },
  kostebek: { name: 'Kör Köstebek', min: 0, w: 10, pal: { a: '#4a3a4a', b: '#6e5e70', c: '#2a1a2a', x: '#f08aa0' }, lore: 'Hiçbir şey görmez ama her şeyi bilir.',
    art: ['..............', '..............', '....aaaaaa....', '...abbbbbbaa..', '..abbbbbbbbaa.', '.abbbbbbbkbbaa', '.abbbbbbbbbpax', '.aabbbbbbbbaxx', '..aaaaaaaaaa..', '..aaaaaaaaaa..', '.xx.......xx..'] },
  mantarKedi: { name: 'Mantar Kedi', min: 2, w: 8, pal: { a: '#e09a58', b: '#f8d8b0', c: '#a06030', x: '#d84050' }, lore: 'Başındaki mantar onun değil, o mantarın.',
    art: ['......xxxxx...', '.....xwxxwxx..', '....xxxxxxxxx.', '.....a.bbb.a..', '.....aaaaaaa..', '.....aekaaeka.', '.....akkaakka.', '.a...apbxbpa..', '.a..aaaaaaaa..', '..aaabbbbbaa..', '..c.c...c.c...'] },
  isikBocegi: { name: 'Işık Böceği', min: 3, w: 8, pal: { a: '#4a6a3a', b: '#9ad06a', c: '#2a3a2a', x: '#fff08a' }, lore: 'Karanlıkta sana yolu gösterir, bazen.',
    art: ['.......b...b..', '........b.b...', '.......aaaaa..', '......aekaeka.', '......akkakka.', '..bb..aapaapa.', '.bbbbaaaaaaa..', '.xxxxxaaaaa...', 'xxxwxxxaaa....', '.xxxxx.c.c....', '..............'] },
  kristalKapl: { name: 'Kristal Kaplumbağa', min: 4, w: 7, pal: { a: '#5aa0b8', b: '#bff4ff', c: '#3a7088', x: '#7ab050' }, lore: 'Kabuğu her yüz yılda bir kat büyür.',
    art: ['.....w..w.....', '....bab.bab...', '...babbabbab..', '..aabbaabbaa..', '.aabbaabbaabb.', '.aaaaaaaaaaxx.', '.cccccccccxxek', '..ccccccccxxpx', '...xx....xx...', '...xx....xx...', '..xxx...xxx...'] },
  lavSemender: { name: 'Lav Semenderi', min: 6, w: 6, pal: { a: '#e05a2a', b: '#ffb050', c: '#8a2a1a', x: '#fff08a', p: '#ffd0a0' }, lore: 'Soğuk seviyor. Hiç bulamadı.',
    art: ['..............', '..............', '..............', '.........aaaa.', '.........aaeka', 'a.......aaakka', 'ba..aaaaaapaa.', '.baaaxaaxaaaa.', '..aabbbbbbaa..', '...c.c...c.c..', '..............'] },
  tasYengec: { name: 'Taş Yengeç', min: 8, w: 6, pal: { a: '#7a7a8c', b: '#b0b0c4', c: '#4a4a5a', x: '#e07050' }, lore: 'Yan yan yürür, düz düşünür.',
    art: ['.xx........xx.', 'xxx........xxx', '.xx..e..e..xx.', '..x..k..k..x..', '..x.aaaaaa.x..', '..aabbbbbbaa..', '.aabwbbbbbbaa.', '.aabpbbbbpbaa.', '..aaaaaaaaaa..', '.c.c.c..c.c.c.', 'c.c.c....c.c.c'] },
  karGelincik: { name: 'Kar Gelinciği', min: 10, w: 5, pal: { a: '#dde8f2', b: '#ffffff', c: '#9aaabb', x: '#202030' }, lore: 'Derinde kar yağmaz. O yine de beyaz.',
    art: ['..............', '..............', '..............', '..........aa..', '.........aaaa.', '........aaaeka', '........abakkx', 'xx..aaaaaabpa.', '.xaaabbbbbbaa.', '..aaaaaaaaaa..', '...c.c...c.c..'] },
  hayaletTilki: { name: 'Hayalet Tilki', min: 12, w: 5, pal: { a: '#8fdcf8', b: '#e0f8ff', c: '#4aa0c8', x: '#ffffff' }, lore: 'Ayak izi bırakmaz ama hep yanındadır.',
    art: ['..............', '..............', '........a...a.', '........aa.aa.', '........aaaaa.', '.......abbeka.', '.......abbkkax', '.bb....abpbba.', 'bbba..aaaaaa..', '.bbaaaaaaaaa..', '...c.c...c.c..'] },
  gozYarasa: { name: 'Tek Göz Yarasa', min: 14, w: 5, pal: { a: '#6a3a8a', b: '#9a6aba', c: '#3a1a4a', x: '#ffd24a' }, lore: 'Bir gözü var, o da sende.',
    art: ['..............', 'a............a', 'aa...a..a...aa', 'aaa..aaaa..aaa', 'abaaabbbbaaaba', 'abbaaeekaaabba', '.abaaekkaaaba.', '..a.apaapa.a..', '.....aaaa.....', '.....w..w.....', '..............'] },
  kokAhtapot: { name: 'Kök Ahtapotu', min: 17, w: 4, pal: { a: '#5a8a4a', b: '#a0c878', c: '#3a5a2a', x: '#f0a0c0' }, lore: 'Sekiz kolu da ağaç köküne sarılı.',
    art: ['......bb......', '.....bbcbb....', '.......c......', '....aaaaaa....', '...abbbbbba...', '..abekbbekba..', '..abkkbbkkba..', '..apbbbbbbpa..', '..aaaaaaaaaa..', '.a.aa.aa.aa.a.', 'c.a..a..a..a.c'] },
  yildizSalyangoz: { name: 'Yıldız Salyangozu', min: 20, w: 4, pal: { a: '#e8c060', b: '#fff08a', c: '#a08030', x: '#b060f0' }, lore: 'Kabuğunda gökyüzünün bir parçası taşır.',
    art: ['..........k.k.', '...xxxx...a.a.', '..xxbbxx..a.a.', '.xxbwbbxx.aaa.', '.xbbbwbbx.apa.', '.xbwwwbbxaaaa.', '.xxbwbbxxaaaa.', '..xxxxxxaaa...', 'aaaaaaaaaaaa..', 'cccccccccccc..', '..............'] },
  minikEjder: { name: 'Minik Ejder', min: 23, w: 3, pal: { a: '#c84050', b: '#f08878', c: '#701a2a', x: '#ffd24a' }, lore: 'Henüz ateş püskürtemiyor. Hapşırıyor.',
    art: ['..............', '.........x.x..', '.........aaaa.', '.bb.....aaekaa', 'bbbb....aakkaa', '.bbbb..aaapaax', '..bbbaaaaaaaa.', 'a...aaaxxxaa..', '.a.aaaaxxxaa..', '..aaa.aaaaa...', '.....c...c....'] },
  boslukBalik: { name: 'Boşluk Balığı', min: 26, w: 3, pal: { a: '#3a2a6a', b: '#8a6aff', c: '#1a0a3a', x: '#ffffff' }, lore: 'Suyu yok, yine de yüzüyor.',
    art: ['..............', '..............', '.....bbb......', '....bbaab.....', 'b..aaawaaaa...', 'bb.aaaaaaaeka.', 'bbbaaawaaakka.', 'bb.aaaaaapaax.', 'b..aawaaaaaa..', '....bbaab.....', '.....bbb......'] },
};
export const CRITTER_KEYS = Object.keys(CRITTERS);
// biyom başına bir yaratık olma şansı; yakalama mesafesi (px)
export const CRITTER = { chance: 0.55, reach: 14 };
