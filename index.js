const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");

// =====================
// CLIENT
// =====================

const client = new Client({

  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]

});

// =====================
// TOKEN
// =====================

const TOKEN = process.env.TOKEN;

// =====================
// CACHE PERSISTENTE EN DISCO
// =====================

const CACHE_FILE = "./item_cache.json";

function loadCache() {

  try {

    if (fs.existsSync(CACHE_FILE)) {

      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      const obj = JSON.parse(raw);
      return new Map(Object.entries(obj));

    }

  } catch (err) {

    console.error("❌ Error cargando cache:", err);

  }

  return new Map();

}

function saveCache(map) {

  try {

    const obj = Object.fromEntries(map);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));

  } catch (err) {

    console.error("❌ Error guardando cache:", err);

  }

}

// =====================
// LOOP DATA
// =====================

let loopEnabled  = false;
let loopChannel  = null;
let sentItems    = new Set();
let itemCache    = loadCache(); // ✅ carga desde disco al iniciar

// =====================
// ONLINE
// =====================

client.once("clientReady", () => {

  console.log(`🔥 Bot online como ${client.user.tag}`);

});

// =====================
// GET ITEMS
// =====================

async function getItems() {

  const response = await fetch("https://www.rolimons.com/free-roblox-limiteds");
  const html     = await response.text();
  const match    = html.match(/item_details\s*=\s*(\{[\s\S]*?\});/);

  if (!match) {

    console.log("❌ item_details no encontrado");
    return null;

  }

  let data;

  try {

    data = JSON.parse(match[1]);

  } catch (err) {

    console.log(err);
    return null;

  }

  return Object.entries(data).map(([id, item]) => ({

    id,
    name:           item[0],
    timestamp:      item[1],
    totalStock:     item[2],
    availableStock: item[3],
    thumbnail:      item[5],
    games:          item[6]

  }));

}

// =====================
// HELPER — guardar item en cache + disco
// =====================

function cacheItem(item) {

  itemCache.set(item.id, item);
  saveCache(itemCache); // ✅ persiste aunque el bot se reinicie

}

// =====================
// CREATE EMBEDS
// =====================

function createItemEmbed(item) {

  const gameText =
    item.games?.length
      ? item.games
          .map(g => `[${g.name}](https://www.roblox.com/games/${g.game_id})`)
          .join("\n")
      : "Unknown";

  return new EmbedBuilder()

    .setTitle(`🔥 ${item.name.toUpperCase()} 🔥`)
    .setURL(`https://www.roblox.com/catalog/${item.id}`)
    .setThumbnail(item.thumbnail)
    .setImage(item.thumbnail.replace("/150/150/", "/420/420/"))
    .setDescription(`# 📦 STOCK\n# ${item.availableStock}/${item.totalStock}`)
    .addFields(
      { name: "🎮 JUEGO", value: gameText, inline: false },
      { name: "🔗 ITEM",  value: `https://www.roblox.com/catalog/${item.id}`, inline: false },
      { name: "🆔 ID",    value: `\`${item.id}\``, inline: false }
    )
    .setColor(0xff0000)
    .setFooter({ text: "Rolimons Tracker 😈" });

}

function createAnnounceButton(item) {

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`announce_${item.id}`)
      .setLabel("📢 Anunciar")
      .setStyle(ButtonStyle.Primary)
  );

}

function createAnnouncementEmbed(item, extraText) {

  return new EmbedBuilder()
    .setTitle(`🎁 ${item.name}`)
    .setImage(item.thumbnail.replace("/150/150/", "/420/420/"))
    .setDescription(
      `# 📦 STOCK\n# ${item.availableStock}/${item.totalStock}\n\n${extraText || ""}`
    )
    .setColor(0xff0000)
    .setFooter({ text: "Anuncio UGC" });

}

// =====================
// LOOP CHECK
// =====================

setInterval(async () => {

  if (!loopEnabled) return;

  const items = await getItems();
  if (!items) return;

  items.sort((a, b) => b.timestamp - a.timestamp);
  const newest = items[0];

  if (sentItems.has(newest.id)) return;

  sentItems.add(newest.id);
  cacheItem(newest); // ✅ guardar ANTES de enviar

  try {

    const channel = await client.channels.fetch(loopChannel);

    await channel.send({
      embeds:     [createItemEmbed(newest)],
      components: [createAnnounceButton(newest)]
    });

    console.log(`🔥 Nuevo item enviado: ${newest.name}`);

  } catch (err) {

    console.log(err);

  }

}, 10000);

// =====================
// MESSAGES
// =====================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  if (
    message.content.startsWith("+") &&
    !message.member?.permissions?.has(PermissionsBitField.Flags.Administrator)
  ) {
    return message.reply("❌ Solo administradores pueden usar este bot.");
  }

  console.log(message.content);

  // ── +ping ──────────────────────────────────────

  if (message.content === "+ping") {
    return message.reply("🏓 Pong 😈");
  }

  // ── +help ──────────────────────────────────────

  if (message.content === "+help") {

    const embed = new EmbedBuilder()
      .setTitle("📚 COMANDOS DISPONIBLES")
      .setDescription(`# 💖 Jory Commands`)
      .addFields(
        { name: "🏓 +ping",      value: "Verifica si el bot está online.",                  inline: false },
        { name: "🔥 +actual",    value: "Muestra el item más reciente.",                    inline: false },
        { name: "🔥 +actual 5",  value: "Muestra varios items recientes.",                  inline: false },
        { name: "📦 +stok 100",  value: "Busca items con 100 stock disponible.",            inline: false },
        { name: "📦 +sstok 100", value: "Busca items con 100 stock total.",                 inline: false },
        { name: "🔄 +loop",      value: "Activa detección automática de nuevos items.",     inline: false },
        { name: "🛑 +stop",      value: "Detiene el loop automático.",                      inline: false }
      )
      .setColor(0xff0000)
      .setFooter({ text: "Rolimons Tracker 😈" });

    return message.reply({ embeds: [embed] });

  }

  // ── +actual ────────────────────────────────────

  if (message.content.startsWith("+actual")) {

    const args   = message.content.split(" ");
    const amount = parseInt(args[1]) || 1;
    const items  = await getItems();

    if (!items) return message.reply("❌ Error obteniendo items");

    items.sort((a, b) => b.timestamp - a.timestamp);

    for (const item of items.slice(0, amount)) {
      cacheItem(item);
      await message.channel.send({
        embeds:     [createItemEmbed(item)],
        components: [createAnnounceButton(item)]
      });
    }

  }

  // ── +sstok (total stock) ───────────────────────

  if (message.content.startsWith("+sstok")) {

    const args  = message.content.split(" ");
    const stock = parseInt(args[1]);

    if (!stock) return message.reply("❌ Usa: +sstok 100");

    const items = await getItems();
    if (!items) return;

    const filtered = items.filter(x => x.totalStock === stock);

    if (filtered.length === 0) return message.reply("❌ No encontrados");

    for (const item of filtered.slice(0, 10)) {
      cacheItem(item);
      await message.channel.send({
        embeds:     [createItemEmbed(item)],
        components: [createAnnounceButton(item)]
      });
    }

  }

  // ── +stok (available stock) ────────────────────

  if (message.content.startsWith("+stok")) {

    const args  = message.content.split(" ");
    const stock = parseInt(args[1]);

    if (!stock) return message.reply("❌ Usa: +stok 100");

    const items = await getItems();
    if (!items) return;

    const filtered = items.filter(x => x.availableStock === stock);

    if (filtered.length === 0) return message.reply("❌ No encontrados");

    for (const item of filtered.slice(0, 10)) {
      cacheItem(item);
      await message.channel.send({
        embeds:     [createItemEmbed(item)],
        components: [createAnnounceButton(item)]
      });
    }

  }

  // ── +loop ──────────────────────────────────────

  if (message.content.startsWith("+loop")) {

    const args      = message.content.split(" ");
    const channelId = args[1] || message.channel.id;

    loopEnabled = true;
    loopChannel = channelId;
    sentItems.clear();

    return message.reply(`🔥 Loop activado 😈\n\nCanal:\n${channelId}`);

  }

  // ── +stop ──────────────────────────────────────

  if (message.content === "+stop") {

    loopEnabled = false;
    loopChannel = null;

    return message.reply("🛑 Loop detenido 😈");

  }

});

// =====================
// INTERACTIONS
// =====================

client.on("interactionCreate", async (interaction) => {

  // ════════════════════════════════════════════════
  // BOTÓN — announce_<itemId>
  // ════════════════════════════════════════════════

  if (interaction.isButton()) {

    if (interaction.customId.startsWith("announce_")) {

      // ✅ deferReply AL INSTANTE — Discord exige respuesta en < 3 segundos
      // Con deferReply tienes hasta 15 minutos para editReply
      await interaction.deferReply({ ephemeral: true });

      // ── Verificar permisos ──
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        return interaction.editReply({
          content: "❌ Solo administradores pueden usar esto."
        });
      }

      // ── Extraer itemId (todo lo que sigue de "announce_") ──
      const itemId = interaction.customId.slice("announce_".length);
      const item   = itemCache.get(itemId);

      if (!item) {
        return interaction.editReply({
          content: "❌ No encontré los datos de este item. Usa el comando otra vez."
        });
      }

      // ── Selector de canal ──
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`announce_channel|${itemId}`) // ✅ separador "|" — nunca se rompe
          .setPlaceholder("Selecciona el canal del anuncio")
          .setChannelTypes(ChannelType.GuildText)
      );

      return interaction.editReply({
        content:    "📢 Selecciona el canal donde quieres anunciar este item:",
        components: [row]
      });

    }

  }

  // ════════════════════════════════════════════════
  // SELECT CANAL — announce_channel|<itemId>
  //
  // ⚠️  IMPORTANTE: este interaction abre un Modal.
  //     Discord NO permite deferReply antes de showModal.
  //     La respuesta DEBE ser showModal directamente.
  //     El cache es solo lectura (instantáneo), así que
  //     no hay riesgo de timeout aquí.
  // ════════════════════════════════════════════════

  if (interaction.isChannelSelectMenu()) {

    if (interaction.customId.startsWith("announce_channel|")) {

      const itemId    = interaction.customId.slice("announce_channel|".length);
      const channelId = interaction.values[0];
      const item      = itemCache.get(itemId);

      // Si no hay item, no podemos abrir modal — defer + editReply
      if (!item) {
        await interaction.deferReply({ ephemeral: true });
        return interaction.editReply({
          content: "❌ No encontré los datos del item."
        });
      }

      // ── Construir modal ──
      const modal = new ModalBuilder()
        .setCustomId(`announce_modal|${itemId}|${channelId}`) // ✅ separador "|"
        .setTitle("Texto extra del anuncio");

      const extraInput = new TextInputBuilder()
        .setCustomId("extra_text")
        .setLabel("Texto extra, links, notas, etc.")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(extraInput)
      );

      // ✅ showModal — es la respuesta directa a esta interacción
      return interaction.showModal(modal);

    }

  }

  // ════════════════════════════════════════════════
  // MODAL SUBMIT — announce_modal|<itemId>|<channelId>
  // ════════════════════════════════════════════════

  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith("announce_modal|")) {

      // ✅ deferReply AL INSTANTE — el fetch del canal puede tardar
      await interaction.deferReply({ ephemeral: true });

      // ── Verificar permisos ──
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        return interaction.editReply({
          content: "❌ Solo administradores pueden usar esto."
        });
      }

      // ── Extraer partes con split("|") — 100% seguro con IDs de Discord ──
      const parts     = interaction.customId.split("|");
      // parts[0] = "announce_modal"
      // parts[1] = itemId
      // parts[2] = channelId
      const itemId    = parts[1];
      const channelId = parts[2];

      const item = itemCache.get(itemId);

      if (!item) {
        return interaction.editReply({
          content: "❌ No encontré los datos del item."
        });
      }

      // ── Texto extra del modal ──
      const extraText = interaction.fields.getTextInputValue("extra_text");

      // ── Enviar anuncio ──
      try {

        const channel       = await client.channels.fetch(channelId);
        const announceEmbed = createAnnouncementEmbed(item, extraText);

        await channel.send({ embeds: [announceEmbed] });

        return interaction.editReply({
          content: "✅ Anuncio enviado correctamente."
        });

      } catch (err) {

        console.error("❌ Error enviando anuncio:", err);

        return interaction.editReply({
          content: "❌ Hubo un error al enviar el anuncio. Verifica que el bot tenga permisos en ese canal."
        });

      }

    }

  }

});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
