/* know.js — the book. A living knowledge base on the Guide tab:
   this shop, right now, what to do, and every system with a name. */
(function () {
  "use strict";

  var lastUi = 0;
  var mode = "shop";
  var query = "";
  var seeded = false;
  var painting = false;
  var openId = "";
  var seen = Object.create(null);
  var factCache = null;

  var EXTRA = [
    {
      id: "k_hour",
      sec: "When you are stuck",
      t: "The first hour",
      tags: "start stuck beginner first hour pellets filter tank shop gold line letter",
      w: "<p>You open in Year {year}. The tanks are already running. Click the water to feed. If the filter pill goes sour, click it. That is the whole first hour, and the rest of the shop is waiting on it.</p><p>People come in off Salem Street. They will look. They will ask for a fish by name. They only buy if you keep two adults of the same kind.</p><p>The gold line under the name is the unfinished thing. This morning it is often a letter. {letter}</p><p><b>What to do about it:</b> feed, watch the water, do not sell the last of a pair, and read the gold line before you click anything else.</p>",
    },
    {
      id: "k_nobuy",
      sec: "When you are stuck",
      t: "Nobody is buying",
      tags: "stuck walkins till stock pair HA sales customers want",
      w: "<p>Walk-ins are not sales. Someone comes in because they have need and a bit of cash. They buy if the shop has two grown fish of one kind and the water is not off. Otherwise they look and leave, and Life writes it on the till: walked, not sold.</p><p>If they asked for a betta and you do not keep two, that is the lesson. A unique fish is a display. A pair is stock.</p><p><b>What to do about it:</b> buy or breed a pair, clean the filter, and be open at lunch. Reputation and ads pull from further down the street. A shop nobody has heard of is a neighborhood shop.</p>",
    },
    {
      id: "k_water",
      sec: "When you are stuck",
      t: "The water is going off",
      tags: "stuck filter clog sick ich cycle heater filter clogged",
      w: "<p>A clogged filter is the shop turning people around at the door. Sick fish make the ones who stay talk. Ich is an outbreak, not a mood. The nitrogen cycle does not care that you were in the Atlas.</p><p>{filter}</p><p><b>What to do about it:</b> click the clog pill on the HUD. Feed less if ammonia is up. Heat if the room is following a cold street. The Calendar tells you the season; winter will punish an unheated tank.</p>",
    },
    {
      id: "k_current",
      sec: "The animals",
      t: "Water in motion",
      tags: "water physics current motion wake feeding filter fins flow ripples",
      w: "<p>The filter moves the water. Small suspended flecks follow the same current the fish swim through. Swimming fish leave brief wakes; feeding disturbs nearby water, and pellets drift with it.</p><p>The tank surface settles after a disturbance. Shop tanks have their own small surface waves. A change of tank clears the previous tank's wakes.</p><p><b>What to do about it:</b> feed once and watch the drift. Clear a clogged filter before feeding again. A calm surface is not a water-quality reading; the filter and chemistry still need care.</p>",
    },
    {
      id: "k_broke",
      sec: "When you are stuck",
      t: "The till is thin",
      tags: "stuck coins money orders sell exchange levy bills",
      w: "<p>Coins come from sales, orders, and the odd curiosity. Bills do not wait. Selling the last of a pair to make rent is how the till stays quiet tomorrow.</p><p>Today the till has {coins} on it. Sold {sales}. Walked {walked}.</p><p><b>What to do about it:</b> fill an order if one is on the book. Check the Exchange before you dump a group. Standing orders pay slowly and do not empty the rack. The Money tab is where the levy lives, not a surprise.</p>",
    },
    {
      id: "k_bored",
      sec: "When you are stuck",
      t: "When the shop is running itself",
      tags: "bored curious atlas chronicle name secrets map boat book almanac",
      w: "<p>If the water is holding and people are still looking, the game is not empty. It is waiting for you to read it. Fish have names and thoughts. The street has regulars. The Atlas has a thousand years. The back room has a book that should not be there.</p><p>This shop, this seed, this year: {year}. {named} named in the water. {age}</p><p><b>What to do about it:</b> open Guide, This shop. Name a fish. Open Life. Walk the Map. Open the Chronicle. Click a keep on the Atlas.</p>",
    },
    {
      id: "k_till",
      sec: "The shop floor",
      t: "The till today",
      tags: "till sales walked want regulars life lockup",
      w: "<p>Life keeps a till for the day: sold, walked, and who asked for what. A walk-out with a name is the shop teaching you. Lock the door after last hour and the chronicle writes the tally. Year of the millennial clock goes on the line with it.</p><p>This morning: sold {sales}, walked {walked}. Regulars come back. The second sale is the one that puts them on the book.</p><p><b>What to do about it:</b> read Life when the floor is quiet. If walked is beating sold, you are short a pair or the water is off.</p>",
    },
    {
      id: "k_site",
      sec: "The shop floor",
      t: "The site",
      tags: "site physics tiles heat water leak filter oak boards aisle gravity daybook",
      w: "<p>The shop is a place. Oak boards, glass, iron, standing water. Heat moves. A clogged filter leaks downhill. Rain at the door wets the aisle. Life shows the site as a little map because the building is not a menu.</p><p><b>What to do about it:</b> clean the filter before the boards go dark. The gold line will say it. The daybook will keep it.</p>",
    },
    {
      id: "k_want",
      sec: "The shop floor",
      t: "What they came for",
      tags: "want betta guppy tetra stock pair floor speech coming",
      w: "<p>People on the floor ask for a fish by name. If you have two of that fish they will say they will take it. If you do not, they ask whether you keep it, and then they leave.</p><p>{coming}</p><p><b>What to do about it:</b> keep pairs of what the street is asking for. A unique fish is a display. A pair is stock. The gold line names who is coming if someone is.</p>",
    },
    {
      id: "k_clock",
      sec: "The world before you",
      t: "Present day",
      tags: "year 1000 millennial clock calendar atlas history indefinite",
      w: "<p>Present day is Year {year}. A thousand years of the harbor already ran, and the clock does not stop. Seasons are twenty-eight days. A play day is twenty minutes unless you follow the real clock. HUD, Chronicle, lots, Life and the Atlas all use the same year.</p><p>The year does not run out. {age}</p><p><b>What to do about it:</b> the Calendar is the desk for this. The Atlas is the history. Watching a year turn is a secret.</p>",
    },
    {
      id: "k_necro",
      sec: "The world before you",
      t: "The Necronomicon",
      tags: "occult book dead raise back room necronomicon pages",
      w: "<p>There is a book in the back room. It is not a ledger. Names in it are dead fish the harbor still remembers. Calling a name back puts them in the tank with something wrong about the eyes. The street does not hear a splash. People still cross themselves.</p><p>Opening it is a secret. Raising is another. A risen fish is not stock. The choir comes back a half-step off.</p><p><b>What to do about it:</b> go Back, click the book. Do not do it because you are short on stock.</p>",
    },
    {
      id: "k_wx",
      sec: "The shop floor",
      t: "Weather on the glass",
      tags: "weather rain snow fog gale window shop",
      w: "<p>The shop window is the street. Rain runs on it. Fog takes the yellow house. A gale empties Salem Street. The room the tank sits in follows the outside with a lag, so a cold snap is a heater, and a heatwave is a tank you cannot cool.</p><p><b>What to do about it:</b> stand in the Shop and watch. Calendar has the numbers. A secret unlocks if you are in the shop while weather is on the glass.</p>",
    },
    {
      id: "k_secrets",
      sec: "You and your people",
      t: "Secrets and records",
      tags: "secrets eggs achievements records legendary tillwalk necro year",
      w: "<p>Secrets are hidden things: Konami, a name, midnight, the other book, a walk-out for a fish you did not have. Each one pays reputation and a pearl. Records on Level climb forever on numbers the shop already keeps: sales, years past the thousand, people who left without a fish bag, names called back.</p><p>Legendaries are six late things that survive a restart. None of them multiply income, because that would just make the game shorter.</p><p><b>What to do about it:</b> Secrets tab to see what you have. Level for the records. Do not hunt them with a list in another window. The shop tells you.</p>",
    },
    {
      id: "k_supply",
      sec: "Money",
      t: "Harbor Supply",
      tags: "stock conditioner bags gravel lots year shop tab fish bag",
      w: "<p>Harbor Supply is the shop tab's top: lots dated to the millennial year. Conditioner, fish bags, pads, cubes. They empty. They pack. They thaw. Buying them writes the year into the chronicle.</p><p>Customers do not come in for conditioner. That is you. A fish bag is not a receipt. It is a vector. What leaves in it can come back as fry, as fever, as a window on Salem.</p><p><b>What to do about it:</b> open Shop, read the lots, buy before a tank goes sour rather than after.</p>",
    },
    {
      id: "k_name",
      sec: "The animals",
      t: "Names and thoughts",
      tags: "name nick thoughts chronicle saga fish curious",
      w: "<p>Every fish gets a name. They think about the water, the weather, the year, who they swim with, and whether someone came back from the pages. Click a fish for its card. Life lists what they are thinking. The Chronicle is the chain of why.</p><p>In this water: {named}.</p><p><b>What to do about it:</b> name twenty and you have a secret. Read a thought, then open the Chronicle and see the line that put it there.</p>",
    },
    {
      id: "k_map",
      sec: "The quarter",
      t: "The street outside",
      tags: "map salem north end jobs crowd walkins bored baker window routes landmarks night lights",
      w: "<p>The Map is the North End, not a circle of ants. People have homes, trades, faiths, and a reason to be on a block. Some of them walk to your door. Some go to Haymarket. Some are at sea.</p><p>{baker} {windows}</p><p><b>What to do about it:</b> open Map when the shop is quiet. Click a window. Life lists who has been in. A campaign is a bigger circle, not just a multiplier.</p>",
    },
    {
      id: "k_act",
      sec: "You and your people",
      t: "The console and /act",
      tags: "console act command gun street crowd",
      w: "<p>Slash opens the console. <kbd>/act</kbd> is you doing a thing in the world: the street notices, the floor notices, the water notices. A loud thing on Salem Street empties the shop. Kindness is cheaper and still shows.</p><p><b>What to do about it:</b> try a quiet act before a loud one. The Guide is not a list of acts. The street is the list.</p>",
    },
    {
      id: "k_guild",
      sec: "The shop floor",
      t: "The hall",
      tags: "guild dues standing mandate boycott till hall",
      w: "<p>There is a hall for people who sell living water. Dues, standing, a mandate pair. Fill it and they speak well. Miss the week and they put the word out. A boycott is an empty aisle.</p><p>{hall}</p><p><b>What to do about it:</b> keep the pair they asked for. Pay the week. Life will say if they have turned.</p>",
    },
    {
      id: "k_fever",
      sec: "The shop floor",
      t: "Fever",
      tags: "fever ich sick street heat treat clog beast",
      w: "<p>A sickness that walks the road. Heat, sometimes a name. People look from the door. The glass can catch it. A clogged filter feeds it. A beast off the harbor feeds it.</p><p>{sick}</p><p><b>What to do about it:</b> treat the water. Clean the filter. The gold line will say the name if it has one.</p>",
    },
    {
      id: "k_craft",
      sec: "The shop floor",
      t: "The hands",
      tags: "craft quality bag masterwork plaque combo till fish bag",
      w: "<p>A fish bag has quality. A tank has a plaque in a tongue spoken inland. String sales and the hands remember. A masterwork is someone who pays and tells the hall.</p><p>A day without a fish bag and the knot is sloppy. People say so. They walk. Treat with rusty water-hands and still-sickness comes back.</p><p><b>What to do about it:</b> do not break the run. The gold line says when a fish bag was good.</p>",
    },
    {
      id: "k_gold",
      sec: "The shop floor",
      t: "The gold line",
      tags: "gold line whisper unfinished letter till hud hook",
      w: "<p>One line under the name. Always one unfinished thing. A letter, a run, a wet aisle, a name due on the wall. It is not a quest log. It is the thing the shop will not let you forget.</p><p>This morning: {gold}</p><p>A letter wins the first morning. The rest of the street has to wait. If you answer the letter, the line can move.</p><p><b>What to do about it:</b> read it. Do that thing. Do not hunt a second HUD. There isn't one.</p>",
    },
    {
      id: "k_bag",
      sec: "The shop floor",
      t: "A fish bag",
      tags: "fish bag sale vector window fry fever stock pair",
      w: "<p>A fish bag is not a deletion. They go home with someone on Salem. The baker's window is a tank. If they live, she will say so. If they breed, she brings the fry. If they die on the block, the name goes in the book from the street, not the glass.</p><p>The fish bag carries the water. White-spot, gold-dust, fin-rot, still-sickness, salt-itch: each one hates a different bottle. Treat it, or the choir sours until the name breaks.</p><p><b>What to do about it:</b> keep two of a kind before you bag. Open Map after a sale. Their window is lit.</p>",
    },
    {
      id: "k_still",
      sec: "The animals",
      t: "Still-sickness",
      tags: "still-sickness still holding sick named remaining pair",
      w: "<p>A fish holding still is not always rest. Still-sickness is a name for the ones who stop because the other of the pair is gone, or because the water is wrong, or because a fight ended on the gravel.</p><p>{still}</p><p>The remaining of a pair holds still because the other one is in a window on Salem. That is not a meter. That is grief in the water.</p><p><b>What to do about it:</b> do not bag the last of a pair. Treat if a bottle will do it. Life will name who is holding still.</p>",
    },
    {
      id: "k_plate",
      sec: "The world before you",
      t: "A name on the wall",
      tags: "name on the wall plate chalk dead unburied ingum haunt",
      w: "<p>A name cannot stay in the book without writing. The dead want a name on the wall. Chalk writes it. The water goes quiet. You inherited the unburied.</p><p>{unburied}</p><p>Ingum has been dead since Year 412. The previous keeper never put her on the wall. At night she is in the shop window. People leave. Named fish hold still. Chalk writes the name. She rests.</p><p><b>What to do about it:</b> when the gold line says a name is due, write it. Vinegar does not clean the morning. Chalk does.</p>",
    },
    {
      id: "k_inland",
      sec: "The quarter",
      t: "The inland town",
      tags: "inland town letter road war hold atlas boston",
      w: "<p>Salem Street is one block. Inland is a continent. When a road is cut, the inland town writes. A letter on the counter: a place, a pair, a fish. Fill it. A road to the harbor can reopen. Leave it five days and the gold line stays late.</p><p>{letter} {war}</p><p>Boston is one harbor. The rest of the map was generated from the same seed as the shop. Click a keep on the Atlas. That is a town with a tongue, a fish, a war, a road.</p><p><b>What to do about it:</b> keep two of what they asked for. The letter is not a tab. It is the unfinished thing.</p>",
    },
    {
      id: "k_filter",
      sec: "The shop floor",
      t: "Filter clogged",
      tags: "filter clogged packed leak aisle boards oak",
      w: "<p>Filter clogged is not a metaphor. The pad is full. Water finds downhill. The aisle wets. People turn around at the door. The gold line will say it if the filter is the unfinished thing.</p><p>{filter}</p><p><b>What to do about it:</b> click the clog pill. Buy pads at Harbor Supply before it happens again. A wet aisle from the harbor at night is a different page.</p>",
    },
    {
      id: "k_beast",
      sec: "The chronicle",
      t: "Forgotten beasts",
      tags: "beast forgotten harbor scare till unique body",
      w: "<p>Things that still move, with a year they wake. Not a bestiary screen. A body, a hunger, a material. If they come to the harbor the till feels it. The choir sours. People look from the door and do not come in.</p><p><b>What to do about it:</b> Atlas, The living year. The gold line will say if one is near. Do not treat it like stock.</p>",
    },
    {
      id: "k_geo",
      sec: "The chronicle",
      t: "Under the map",
      tags: "geo elevation rain heat drainage volcanism savagery biome",
      w: "<p>The continent is not a picture. Elevation, rain, heat, drainage, volcanism, savagery. Rivers run downhill. Biomes follow. Civilizations found where the water and the food agreed.</p><p>Boston is a harbor because the east is sea and the west is land, not because a designer put a pin there.</p><p><b>What to do about it:</b> Atlas. The painted plate is the same seed. Click a keep. The water they keep is the biome they sit on.</p>",
    },
    {
      id: "k_tongue",
      sec: "The chronicle",
      t: "Tongues",
      tags: "tongue language plaque name inland civ",
      w: "<p>Every civ keeps a tongue. Names on the map, plaques on the tank, a word a traveler says that is not English. The shop is on a harbor that speaks more than one.</p><p><b>What to do about it:</b> a traveler will say a town you have only read. Atlas has the tongue next to the civ. A plaque in the tank is not decoration. It is a language that got here in a fish bag.</p>",
    },
    {
      id: "k_wild",
      sec: "The animals",
      t: "The living water",
      tags: "wild river scarce stock inland fish bag",
      w: "<p>Inland water has populations. Overfish a kind and the river thins. A traveler will say they heard the river is empty of what you sell. The shop is not an infinite warehouse. It is a mouth on a watershed.</p><p><b>What to do about it:</b> if someone says the river is empty, believe them. Breed here. Do not strip the last wild pair for the till.</p>",
    },
    {
      id: "k_rumor",
      sec: "The quarter",
      t: "Rumour",
      tags: "rumor word street hall heat because",
      w: "<p>The street talks. A death, a theft, a letter, a boycott, a name on the wall. Rumour is heat, not a feed. It lands in the choir and in who still walks in.</p><p><b>What to do about it:</b> Life, Because. The gold line is the rumour that made it to the counter.</p>",
    },
    {
      id: "k_faith",
      sec: "The chronicle",
      t: "The old names",
      tags: "faith god taboo bless civ vow holy",
      w: "<p>Civs keep a faith. Gods take seats. A vow can make a kind holy, and the last of it taboo. Blessing sweetens the choir. A taboo on the aisle is someone who will not bag what you keep.</p><p><b>What to do about it:</b> if they will not take a kind, it is not a price. It is a belief. Atlas names the faith. Do not argue it at the till.</p>",
    },
    {
      id: "k_room",
      sec: "The shop floor",
      t: "The room",
      tags: "room ear morning puddle continent",
      w: "<p>The shop is a room with an ear. The morning has a sound. The puddle has a sound. The continent is not silent just because you are looking at the tank.</p><p><b>What to do about it:</b> stand still. Work mode is the fluorescent hum, and the hum still sours when the water is off.</p>",
    },
    {
      id: "k_hook",
      sec: "The shop floor",
      t: "The run",
      tags: "hook combo fish bag till juice run miss",
      w: "<p>The till is a run. Two fish bags and the coins heat. Five and you should not miss. A miss at three writes the break. Hands remember a run. Hands forget a week away.</p><p><b>What to do about it:</b> keep pairs before lunch. The gold line counts. Do not sell the last of a kind to keep a number going. The number is not the shop.</p>",
    },
    {
      id: "k_mind",
      sec: "The animals",
      t: "What a fish keeps",
      tags: "mind memory needs strange mood memorial thought",
      w: "<p>A fish has a memory, needs, a mood that can turn strange, a memorial if someone they knew died. Life lists the thought. A strange mood can leave an object in the glass.</p><p>{named}</p><p><b>What to do about it:</b> click a fish. Read the card. If they are in a mood, do not bag them yet.</p>",
    },
    {
      id: "k_keeper",
      sec: "You and your people",
      t: "The previous keeper",
      tags: "keeper late rook nedda asa wren pim lila keys",
      w: "<p>You hung the sign. Someone kept this shop before you. The street still uses their names. A fish in the tank is theirs. The baker will say you're not them.</p><p>{keeper}</p><p><b>What to do about it:</b> read Life. The first page is their handwriting. Do not bag the one they named unless you mean it.</p>",
    },
  ];

  function now() {
    return typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
  }

  function esc(s) {
    var map = { "&": "&" + "amp;", "<": "&" + "lt;", ">": "&" + "gt;", '"': "&" + "quot;" };
    return String(s || "").replace(/[&<>"]/g, function (c) { return map[c]; });
  }

  function gs() {
    try {
      if (typeof gameState === "function") return gameState();
      if (typeof gameState === "object" && gameState) return gameState;
    } catch (e) {}
    return null;
  }

  function wikiList() {
    try {
      if (typeof WIKI === "function") return WIKI() || [];
      if (Array.isArray(WIKI)) return WIKI;
    } catch (e) {}
    return [];
  }

  function seedWiki() {
    if (seeded) return;
    var w = wikiList();
    if (!w || !w.push) return;
    for (var i = 0; i < EXTRA.length; i++) {
      var a = EXTRA[i];
      var hit = false;
      for (var j = 0; j < w.length; j++) if (w[j] && w[j].id === a.id) hit = true;
      if (!hit) w.push(a);
    }
    seeded = true;
  }

  function year() {
    try {
      if (window.saga && typeof saga.year === "function") return saga.year();
    } catch (e) {}
    return 1000;
  }

  function fishAll() {
    try {
      if (typeof allFish === "function") return allFish() || [];
    } catch (e) {}
    var g = gs();
    return (g && g.fish) || [];
  }

  function havePair() {
    var c = Object.create(null);
    var list = fishAll();
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!f || (f.stage != null && f.stage !== 2)) continue;
      var k = String(f.sp);
      c[k] = (c[k] || 0) + 1;
      if (c[k] >= 2) return true;
    }
    return false;
  }

  function clogged() {
    try {
      return !!window.clogged;
    } catch (e) {}
    return false;
  }

  function goldLine() {
    try {
      var el = document.getElementById("hookWhisper");
      if (el && el.textContent) return String(el.textContent).trim();
    } catch (e) {}
    return "";
  }

  function facts() {
    if (factCache) return factCache;
    var g = gs() || {};
    var st = g.stats || {};
    var list = fishAll();
    var day = { sales: 0, misses: 0 };
    try {
      if (window.shopLife && shopLife.day) day = shopLife.day() || day;
    } catch (e0) {}
    var named = [];
    var sick = 0;
    var still = 0;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!f) continue;
      if (f.nick) named.push(f.nick);
      if (f.sick || f.cond || f.ill) sick++;
      if (f.still || (f.mind && f.mind.stress > 0.68)) still++;
    }
    var L = null;
    try {
      if (window.going && going.letter) L = going.letter();
    } catch (e1) {}
    var letter = "No letter is open.";
    var from = "no town";
    var want = "a fish";
    if (L && L.open && !L.filled && L.from) {
      from = L.from;
      want = L.want || "goldfish";
      letter = "A letter from " + from + ". They asked for a pair of " + want + ".";
    }
    var baker = "The baker on Salem has not been named yet.";
    try {
      if (window.desk && desk.neighbor) {
        var nb = desk.neighbor();
        if (nb) baker = (nb.known ? nb.name : "The baker on Salem") + " wants " + (nb.want || "goldfish") + ".";
      }
    } catch (e2) {}
    var keeper = "Someone kept this shop before you.";
    try {
      if (window.late && late.keeper) {
        var kp = late.keeper();
        if (kp && kp.n) keeper = kp.n + (kp.note ? ". " + kp.note : " left the keys.");
      }
    } catch (e3) {}
    var age = "";
    var war = "No war is warm at the harbor.";
    var town = "Boston";
    try {
      if (window.realm && realm.world) {
        var w = realm.world();
        if (w) {
          age = w.age || "";
          town = (w.sites && w.sites[0] && w.sites[0].n) || "Boston";
          if (realm.embargo && realm.embargo()) war = "A war inland is still warm. Holds come in late.";
        }
      }
    } catch (e4) {}
    var hall = "The hall has not spoken today.";
    try {
      if (window.guild && guild.boycott && guild.boycott()) hall = "The hall put the word out. The aisle is empty.";
      else if (window.guild && guild.mandate) hall = "The hall wants a pair of " + (guild.mandate() || "goldfish") + ".";
    } catch (e5) {}
    var unburied = "No name is due on the wall.";
    try {
      if (window.mark && mark.due) {
        var due = mark.due() || [];
        if (due.length) unburied = due[0].n + " wants a name on the wall.";
      }
    } catch (e6) {}
    var windows = "";
    try {
      if (window.sill && sill.lit && sill.dark) {
        windows = sill.lit() + " windows lit on Salem. " + sill.dark() + " gone dark.";
      }
    } catch (e7) {}
    var coming = "Nobody is on the book as coming.";
    try {
      if (window.desk && desk.coming) {
        var c = desk.coming();
        if (c && !c.done && c.name) coming = (c.name || "Someone") + " is coming, for " + (c.want || "a fish") + ".";
      }
    } catch (e8) {}
    var filter = clogged() ? "The filter is clogged. People turn around at the door." : "The filter is holding.";
    var gold = goldLine() || letter;
    var out = {
      year: year(),
      age: age,
      seed: g.seed || "",
      baker: baker,
      keeper: keeper,
      from: from,
      want: want,
      letter: letter,
      named: named.length ? named.slice(0, 6).join(", ") : "nobody named yet",
      nnamed: String(named.length),
      still: still ? still + " holding still." : "Nobody is holding still.",
      sick: sick ? sick + " in the water need you." : "The water is not sick.",
      filter: filter,
      war: war,
      town: town,
      hall: hall,
      unburied: unburied,
      windows: windows,
      coming: coming,
      sales: String(day.sales || 0),
      walked: String(day.misses || st.walked || 0),
      coins: String(Math.floor(g.coins || 0)),
      gold: gold,
      pellets: String(Math.floor(g.pellets || 0)),
    };
    factCache = out;
    return out;
  }

  function fillLive(html) {
    var f = facts();
    return String(html || "").replace(/\{([a-z]+)\}/g, function (_, k) {
      return f[k] != null ? esc(String(f[k])) : "";
    });
  }

  function tokens(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(function (w) {
        return w.length > 1;
      });
  }

  function matchArt(a, q) {
    if (!q) return true;
    var t = tokens(q);
    if (!t.length) return true;
    var hay = (a.t + " " + a.sec + " " + (a.tags || "") + " " + String(a.w || "").replace(/<[^>]+>/g, " ")).toLowerCase();
    for (var i = 0; i < t.length; i++) if (hay.indexOf(t[i]) < 0) return false;
    return true;
  }

  function findArt(id) {
    var w = wikiList().concat(EXTRA);
    for (var i = 0; i < w.length; i++) if (w[i] && w[i].id === id) return w[i];
    return null;
  }

  function allArts() {
    var w = wikiList().concat(EXTRA);
    var seenA = Object.create(null);
    var out = [];
    for (var i = 0; i < w.length; i++) {
      var a = w[i];
      if (!a || !a.id || seenA[a.id]) continue;
      seenA[a.id] = 1;
      out.push(a);
    }
    out.sort(function (x, y) {
      var s = String(x.sec || "").localeCompare(String(y.sec || ""));
      if (s) return s;
      return String(x.t || "").localeCompare(String(y.t || ""));
    });
    return out;
  }

  function diagnose() {
    var g = gs() || {};
    var st = g.stats || {};
    var list = fishAll();
    var day = window.shopLife && shopLife.day ? shopLife.day() : { sales: 0, misses: 0 };
    var f = facts();
    var sick = 0;
    var named = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && (list[i].sick || list[i].cond || list[i].ill)) sick++;
      if (list[i] && list[i].nick) named++;
    }
    var pellets = Math.floor(g.pellets || 0);
    var coins = g.coins || 0;
    var out = [];

    if (f.letter && /letter from/i.test(f.letter) && f.from !== "no town")
      out.push({ id: "letter", title: "A letter is on the counter", body: f.letter + " Keep two. Bag that fish. The town is answered.", go: "life", golabel: "Life", art: "k_inland" });
    if (clogged()) out.push({ id: "clog", title: "The filter is clogged", body: "People are turning around at the door. Click the clog pill on the HUD.", go: "tank", golabel: "The tank", art: "k_filter" });
    if (sick) out.push({ id: "sick", title: sick + " in the water need you", body: "A sick fish is not a mood. Open the tank, click them, and get to the vet if a bottle will not do it.", go: "tank", golabel: "The tank", art: "k_water" });
    if (f.unburied && /wants a name/.test(f.unburied))
      out.push({ id: "wall", title: "A name is due on the wall", body: f.unburied + " Chalk writes it. Vinegar does not.", go: "life", golabel: "Life", art: "k_plate" });
    if (/boycott|word out/i.test(f.hall))
      out.push({ id: "hall", title: "The hall put the word out", body: f.hall, go: "life", golabel: "Life", art: "k_guild" });
    if (/war inland/i.test(f.war))
      out.push({ id: "war", title: "A war inland is still warm", body: f.war + " Atlas names the civs.", go: "atlas", golabel: "Atlas", art: "k_inland" });
    if (list.length && pellets <= 0) out.push({ id: "feed", title: "The tin is empty", body: "Click the water once you have pellets. Shop tab sells the tin.", go: "shop", golabel: "Shop", art: "k_hour" });
    if (!havePair() && (day.misses > 0 || (st.walked || 0) > 0)) out.push({ id: "pair", title: "They came for a fish you did not have", body: "Walk-ins look. They buy a pair. A unique fish is a display. Life has the till.", go: "life", golabel: "Your life", art: "k_nobuy" });
    if (coins < 80 && (st.sold || 0) === 0) out.push({ id: "thin", title: "The till is thin", body: "Do not sell the last of a fish. Fill an order or wait for lunch. Money tab is the levy, not a surprise.", go: "bank", golabel: "Money", art: "k_broke" });
    if ((day.sales || 0) === 0 && (day.misses || 0) >= 2) out.push({ id: "walk", title: "The till is all walked", body: day.misses + " left without a fish bag. Water, stock, or both.", go: "life", golabel: "The till", art: "k_till" });
    if (!out.length && named < 1 && list.length) out.push({ id: "name", title: "Nobody in the water has a name you gave them", body: "Click a fish. They already have a name. Read what they are thinking in Life.", go: "life", golabel: "Your life", art: "k_name" });
    if (!out.length) out.push({ id: "hold", title: "The water is holding", body: "Year " + year() + ". If you are bored, that is a different page. If you are curious, open the book.", go: "", golabel: "", art: "k_bored" });
    return out.slice(0, 6);
  }

  function bored() {
    var g = gs() || {};
    var list = fishAll();
    var f = facts();
    var items = [
      { title: "This shop, this seed", body: "Year " + f.year + ". " + f.named + ". Open the almanac.", go: "", golabel: "" },
      { title: "Name someone in the water", body: "Click a fish. Life lists what they think. Twenty names is a secret.", go: "tank", golabel: "The tank" },
      { title: "Read the till", body: "Sold " + f.sales + " against walked " + f.walked + ". Who asked for what.", go: "life", golabel: "Your life" },
      { title: "Walk the North End", body: f.baker + " The Map is jobs and homes, not a circle around you.", go: "street", golabel: "Map" },
      { title: "Click a keep on the Atlas", body: "A thousand years already ran. Present is Year " + year() + ". Every keep is a town with a tongue.", go: "atlas", golabel: "Atlas" },
      { title: "The Chronicle", body: "Cause chains. Weather. The year turning. Who came back from the pages.", go: "chron", golabel: "Chronicle" },
      { title: "The book in the back", body: "Not the wiki. The other one. Names that should stay in it.", go: "back", golabel: "Back" },
      { title: "Secrets", body: (Object.keys((g.eggs || {})).length || 0) + " found. The rest are in the shop, not in a list.", go: "eggs", golabel: "Secrets" },
      { title: "Harbor Supply", body: "Lots dated to Year " + year() + ". Conditioner, fish bags, pads.", go: "shop", golabel: "Shop" },
      { title: "The Calendar", body: "Season, holidays, millennial clock. It does not stop.", go: "cal", golabel: "Calendar" },
    ];
    if (list.length < 2) items.unshift({ title: "Stock a pair", body: "One fish is a display. Two is a shop.", go: "shop", golabel: "Shop" });
    return items.slice(0, 7);
  }

  function curious() {
    var want = [
      "The gold line",
      "A fish bag",
      "The inland town",
      "A name on the wall",
      "Still-sickness",
      "The world beyond the harbor",
      "You are late",
      "The choir",
      "Windows on Salem are tanks",
      "The previous keeper",
    ];
    var picks = [];
    var all = allArts();
    for (var i = 0; i < want.length; i++) {
      for (var j = 0; j < all.length; j++) if (all[j] && all[j].t === want[i]) picks.push(all[j]);
    }
    if (picks.length < 4) {
      for (var k = 0; k < EXTRA.length && picks.length < 8; k++) picks.push(EXTRA[k]);
    }
    return picks.slice(0, 10);
  }

  function articlesForQuery() {
    var all = allArts();
    var out = [];
    for (var i = 0; i < all.length; i++) if (matchArt(all[i], query)) out.push(all[i]);
    return out;
  }

  function btn(go, label) {
    if (!go) return "";
    return '<button type="button" class="buy ghost" data-know-go="' + esc(go) + '">' + esc(label || "Open") + "</button>";
  }

  function artBody(a) {
    return fillLive(a.w || "");
  }

  function artRow(a) {
    return (
      '<div class="row know-art" data-know-art="' +
      esc(a.id) +
      '"><div></div><div><div class="n">' +
      esc(a.t) +
      '</div><div class="d">' +
      artBody(a) +
      "</div></div><div>" +
      (a.go ? btn(a.go, a.golabel) : "") +
      "</div></div>"
    );
  }

  function card(c) {
    return (
      '<div class="row know-card"' +
      (c.art ? ' data-know-art="' + esc(c.art) + '"' : "") +
      '><div></div><div><div class="n">' +
      esc(c.title) +
      '</div><div class="d">' +
      esc(c.body) +
      "</div></div><div>" +
      btn(c.go, c.golabel) +
      "</div></div>"
    );
  }

  function almanac() {
    var f = facts();
    var g = gs() || {};
    var list = fishAll();
    var html = "";
    html += '<div class="sec">This shop</div>';
    html +=
      '<div class="note">Year ' +
      esc(f.year) +
      (f.age ? " · " + esc(f.age) : "") +
      (f.seed ? " · seed " + esc(f.seed) : "") +
      ". " +
      list.length +
      " in the water. The book is this run, not a generic manual.</div>";

    html += '<div class="row know-card"><div></div><div><div class="n">The counter</div><div class="d">';
    html += esc(f.gold) + "<br>" + esc(f.letter) + "<br>" + esc(f.coming);
    html += '</div></div><div>' + btn("life", "Life") + "</div></div>";

    html += '<div class="row know-card"><div></div><div><div class="n">The water</div><div class="d">';
    html += esc(f.named) + " named.<br>" + esc(f.sick) + " " + esc(f.still) + "<br>" + esc(f.filter);
    html += '</div></div><div>' + btn("tank", "The tank") + "</div></div>";

    html += '<div class="row know-card"><div></div><div><div class="n">The street</div><div class="d">';
    html += esc(f.baker) + "<br>" + esc(f.keeper) + (f.windows ? "<br>" + esc(f.windows) : "");
    html += "<br>Sold " + esc(f.sales) + ". Walked " + esc(f.walked) + ". Coins " + esc(f.coins) + ".";
    html += '</div></div><div>' + btn("street", "Map") + "</div></div>";

    html += '<div class="row know-card"><div></div><div><div class="n">Inland</div><div class="d">';
    html += esc(f.town) + " is the harbor.<br>" + esc(f.war) + "<br>" + esc(f.hall);
    html += '</div></div><div>' + btn("atlas", "Atlas") + "</div></div>";

    if (f.unburied && /wants a name/.test(f.unburied)) {
      html += '<div class="row know-card" data-know-art="k_plate"><div></div><div><div class="n">The wall</div><div class="d">';
      html += esc(f.unburied);
      html += "</div></div><div></div></div>";
    }

    var nArt = allArts().length;
    var nSeen = 0;
    for (var k in seen) if (seen[k]) nSeen++;
    html +=
      '<div class="note">' +
      nArt +
      " entries in the book. You have opened " +
      nSeen +
      ". Search, or open the whole book. Click a keep on the Atlas for the town itself.</div>";
    return html;
  }

  function renderBook() {
    var html = "";
    if (openId) {
      var art = findArt(openId);
      html += '<div class="row"><div></div><div><button type="button" class="buy ghost" data-know-mode="book" data-know-back="1">All entries</button></div><div></div></div>';
      if (art) {
        var first = !seen[art.id];
        seen[art.id] = 1;
        html += '<div class="sec">' + esc(art.sec) + "</div>";
        html += '<div class="row know-art know-open"><div></div><div><div class="n">' + esc(art.t) + '</div><div class="d">' + artBody(art) + "</div></div><div></div></div>";
        var all = allArts();
        var related = [];
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === art.id) continue;
          if (all[i].sec === art.sec) related.push(all[i]);
        }
        if (related.length) {
          html += '<div class="sec">Also in ' + esc(art.sec) + "</div>";
          for (var r = 0; r < related.length && r < 8; r++) {
            html +=
              '<div class="row" data-know-art="' +
              esc(related[r].id) +
              '"><div></div><div><div class="n">' +
              esc(related[r].t) +
              "</div></div><div></div></div>";
          }
        }
        if (first) {
          try {
            if (window.desk && desk.think) desk.think("book", art.t);
          } catch (eT) {}
        }
      } else {
        html += '<div class="note">That page is not in this book.</div>';
      }
      return html;
    }
    var all2 = articlesForQuery();
    html += '<div class="note">' + all2.length + " entries. Click a title. The page fills with this shop, this year, this letter.</div>";
    var sec = "";
    for (var a = 0; a < all2.length; a++) {
      if (all2[a].sec !== sec) {
        sec = all2[a].sec;
        html += '<div class="sec">' + esc(sec) + "</div>";
      }
      html +=
        '<div class="row know-toc" data-know-art="' +
        esc(all2[a].id) +
        '"><div></div><div><div class="n">' +
        esc(all2[a].t) +
        "</div></div><div>" +
        (seen[all2[a].id] ? '<span class="pill">read</span>' : "") +
        "</div></div>";
    }
    return html;
  }

  function renderDesk() {
    factCache = null;
    var html = '<div class="know-desk" id="knowDesk">';
    html += '<div class="sec">The book</div>';
    html +=
      '<div class="note">Year ' +
      year() +
      ". A living knowledge base: this shop as it stands, what to do if you are stuck or bored, and every system with a name. " +
      allArts().length +
      " entries.</div>";
    html +=
      '<div class="row"><div></div><div class="qty know-lanes">' +
      '<button type="button" class="buy ' +
      (mode === "shop" ? "" : "ghost") +
      '" data-know-mode="shop">This shop</button>' +
      '<button type="button" class="buy ' +
      (mode === "now" ? "" : "ghost") +
      '" data-know-mode="now">I\'m stuck</button>' +
      '<button type="button" class="buy ' +
      (mode === "bored" ? "" : "ghost") +
      '" data-know-mode="bored">I\'m bored</button>' +
      '<button type="button" class="buy ' +
      (mode === "curious" ? "" : "ghost") +
      '" data-know-mode="curious">I\'m curious</button>' +
      '<button type="button" class="buy ' +
      (mode === "book" ? "" : "ghost") +
      '" data-know-mode="book">The whole book</button>' +
      "</div><div></div></div>";
    html +=
      '<div class="row"><div style="text-align:center;color:var(--muted);font-size:11px">find</div><div><input id="knowSearch" type="search" value="' +
      esc(query) +
      '" placeholder="letter, fish bag, inland town, still-sickness, gold line…" autocomplete="off" spellcheck="false"></div><div>' +
      (query ? '<button type="button" class="buy ghost" data-know-mode="book" data-know-clear="1">Clear</button>' : "") +
      "</div></div>";

    if (query) {
      var found = articlesForQuery();
      html += '<div class="note">' + found.length + " entries match.</div>";
      for (var fq = 0; fq < found.length && fq < 16; fq++) html += artRow(found[fq]);
      html += "</div>";
      return html;
    }

    if (mode === "shop") html += almanac();
    else if (mode === "now") {
      html += '<div class="sec">Right now</div>';
      var d = diagnose();
      for (var i = 0; i < d.length; i++) html += card(d[i]);
    } else if (mode === "bored") {
      html += '<div class="sec">If the shop is running itself</div>';
      var b = bored();
      for (var j = 0; j < b.length; j++) html += card(b[j]);
    } else if (mode === "curious") {
      html += '<div class="sec">If you just want to know</div>';
      var c = curious();
      for (var k = 0; k < c.length; k++) html += artRow(c[k]);
    } else {
      html += renderBook();
    }
    html += "</div>";
    return html;
  }

  function isGuide() {
    var t = document.getElementById("dtitle");
    return !!(t && /guide|the book/i.test(t.textContent || ""));
  }

  function enhance(force) {
    if (!isGuide()) return;
    seedWiki();
    var body = document.getElementById("dbody");
    if (!body) return;
    var existing = document.getElementById("knowDesk");
    if (existing && !force) return;
    painting = true;
    var html = renderDesk();
    if (existing) existing.outerHTML = html;
    else body.insertAdjacentHTML("afterbegin", html);
    painting = false;
    try {
      var desk = document.getElementById("knowDesk");
      if (desk) {
        for (var n = body.firstChild; n; n = n.nextSibling) {
          if (n === desk || n.nodeType !== 1) continue;
          n.style.display = "none";
        }
      }
    } catch (eH) {}
  }

  function go(id) {
    if (id === "map") id = "street";
    if (id === "front") id = "shop";
    var scenes = { tank: 1, shop: 1, street: 1, back: 1, cell: 1 };
    if (scenes[id]) {
      var b = document.querySelector('#scenes [data-scene="' + id + '"]');
      if (b) b.click();
      else if (typeof sceneGo === "function") try { sceneGo(id); } catch (e) {}
      return;
    }
    try {
      if (typeof openTab === "function") openTab(id);
    } catch (e2) {}
  }

  function bind() {
    var body = document.getElementById("dbody");
    if (!body || body.__know) return;
    body.__know = 1;
    body.addEventListener("click", function (e) {
      var artEl = e.target.closest("[data-know-art]");
      if (artEl && isGuide() && !e.target.closest("[data-know-go]")) {
        openId = artEl.getAttribute("data-know-art") || "";
        mode = "book";
        query = "";
        lastUi = 0;
        enhance(true);
        return;
      }
      var t = e.target.closest("[data-know-mode],[data-know-go],[data-know-clear],[data-know-back]");
      if (!t || !isGuide()) return;
      if (t.getAttribute("data-know-clear") || t.getAttribute("data-know-back")) {
        query = "";
        openId = "";
      }
      var m = t.getAttribute("data-know-mode");
      if (m) {
        mode = m;
        if (m !== "book") {
          query = "";
          openId = "";
        }
      }
      var g = t.getAttribute("data-know-go");
      if (g) {
        go(g);
        return;
      }
      lastUi = 0;
      enhance(true);
      var input = document.getElementById("knowSearch");
      if (input && m === "book") input.focus();
    });
    body.addEventListener("input", function (e) {
      if (!e.target || e.target.id !== "knowSearch") return;
      query = e.target.value;
      mode = "book";
      openId = "";
      enhance(true);
      var input = document.getElementById("knowSearch");
      if (input) {
        input.focus();
        try {
          input.setSelectionRange(query.length, query.length);
        } catch (err) {}
      }
    });
  }

  function tick() {
    try {
      bind();
      seedWiki();
      if (now() - lastUi > 0.6) {
        lastUi = now();
        if (isGuide() && !document.getElementById("knowDesk")) enhance();
      }
    } catch (e) {}
  }

  window.know = {
    diagnose: diagnose,
    year: year,
    facts: facts,
    open: function (id) {
      openId = id || "";
      mode = id ? "book" : "shop";
      enhance(true);
    },
  };

  seedWiki();

  if (window.__onBeat) window.__onBeat(tick, 280);
  else setTimeout(function loop() { tick(); setTimeout(loop, 280); }, 280);
})();
