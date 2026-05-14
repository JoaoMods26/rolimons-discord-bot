const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

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
// LOOP DATA
// =====================

let loopEnabled = false;
let loopChannel = null;
let sentItems = new Set();

// =====================
// ONLINE
// =====================

client.once("clientReady", () => {

  console.log(`🔥 Bot online como ${client.user.tag}`);

});

// =====================
// GET ALL ITEMS
// =====================

async function getItems() {

  const response = await fetch("https://www.rolimons.com/free-roblox-limiteds");
  const html = await response.text();
  const match = html.match(/item_details\s*=\s*(\{[\s\S]*?\});/);

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
    name: item[0],
    timestamp: item[1],
    totalStock: item[2],
    availableStock: item[3],
    thumbnail: item[5],
    games: item[6]
  }));

}

// =====================
// GET ITEM BY ID
// =====================

async function getItemById(itemId) {

  const items = await getItems();

  if (!items) return null;

  return items.find(x => x.id === itemId) || null;

}

// =====================
// ROBLOX EVENTS DATA
// =====================

async function getUniverseIdFromPlaceId(placeId) {

  try {

    const res = await fetch(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    );

    if (!res.ok) return null;

    const data = await res.json();

    return data?.[0]?.universeId || null;

  } catch (err) {

    console.log("❌ Error obteniendo universeId:", err);
    return null;

  }

}

async function getExperienceEvents(placeId) {

  try {

    const universeId = await getUniverseIdFromPlaceId(placeId);

    if (!universeId) return null;

    const endpoints = [

      `https://apis.roblox.com/virtual-events/v2/universes/${universeId}/experience-events`,

      `https://apis.roblox.com/virtual-events/v1/universes/${universeId}/experience-events`

    ];

    for (const endpoint of endpoints) {

      const res = await fetch(endpoint);

      if (!res.ok) continue;

      const data = await res.json();

      const events =
        data?.experienceEvents ||
        data?.events ||
        data?.data ||
        [];

      if (!Array.isArray(events) || events.length === 0) {
        continue;
      }

      const event = events[0];

      return {
        title:
          event.title ||
          event.name ||
          "Evento sin título",

        subtitle:
          event.subtitle ||
          event.tagline ||
          event.shortDescription ||
          "Sin subtítulo",

        description:
          event.description ||
          event.longDescription ||
          "Sin descripción",

        startTime:
          event.startTime ||
          event.startDate ||
          event.startsAt ||
          event.eventStartTime ||
          null,

        endTime:
          event.endTime ||
          event.endDate ||
          event.endsAt ||
          event.eventEndTime ||
          null
      };

    }

    return null;

  } catch (err) {

    console.log("❌ Error obteniendo eventos:", err);
    return null;

  }

}

function formatEventDate(value) {

  if (!value) return "Sin datos";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return "Sin datos";
  }

  return date.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

}

// =====================
// EMBEDS
// =====================

async function createItemEmbed(item) {

  const gameText =
    item.games?.length
      ? item.games
          .map(g => `[${g.name}](https://www.roblox.com/games/${g.game_id})`)
          .join("\n")
      : "Unknown";

  const firstGameId =
    item.games?.[0]?.game_id;

  const eventData =
    firstGameId
      ? await getExperienceEvents(firstGameId)
      : null;

  const eventText =
    eventData
      ? `**${eventData.title}**
${eventData.subtitle}

🕒 ${formatEventDate(eventData.startTime)} - ${formatEventDate(eventData.endTime)}

${eventData.description}`
      : "Sin datos de eventos";

  return new EmbedBuilder()

    .setTitle(item.name.toUpperCase())
    .setURL(`https://www.roblox.com/catalog/${item.id}`)
    .setThumbnail(item.thumbnail)
    .setImage(item.thumbnail.replace("/150/150/", "/420/420/"))
    .setDescription(`# 📦 STOCK\n# ${item.availableStock}/${item.totalStock}`)
    .addFields(
      {
        name: "🎮 JUEGO",
        value: gameText,
        inline: false
      },
      {
        name: "📅 EVENTO",
        value: eventText.slice(0, 1024),
        inline: false
      },
      {
        name: "🔗 ITEM",
        value: `https://www.roblox.com/catalog/${item.id}`,
        inline: false
      },
      {
        name: "🆔 ID",
        value: `\`${item.id}\``,
        inline: false
      }
    )
    .setColor(0xff0000)
    .setFooter({ text: "Jory 😈" });

}

// =====================
// EMBED DE ANUNCIO
// =====================

function createAnnouncementEmbed(item, titulo) {

  return new EmbedBuilder()

    .setTitle(titulo)

    .setDescription(
`## ${item.name}

# 📦 STOCK
# ${item.availableStock}/${item.totalStock}`
    )

    .setImage(item.thumbnail.replace("/150/150/", "/420/420/"))

    .setColor(0xff0000)

    .setFooter({ text: "Jory 😈" });

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

  try {

    const channel = await client.channels.fetch(loopChannel);

    await channel.send({
      embeds: [
        await createItemEmbed(newest)
      ]
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

  // ══════════════════════════════
  // +ping
  // ══════════════════════════════

  if (message.content === "+ping") {

    return message.reply("🏓 Pong 😈");

  }

  // ══════════════════════════════
  // +help
  // ══════════════════════════════

  if (message.content === "+help") {

    const embed = new EmbedBuilder()

      .setTitle("📚 COMANDOS DISPONIBLES")
      .setDescription("# 😈 Jory Commands")
      .addFields(

        {
          name: "🏓 +ping",
          value: "Verifica si el bot está online.",
          inline: false
        },

        {
          name: "🔥 +actual",
          value: "Muestra el item más reciente.",
          inline: false
        },

        {
          name: "🔥 +actual 5",
          value: "Muestra varios items recientes.",
          inline: false
        },

        {
          name: "📦 +stok 100",
          value: "Busca items con 100 stock disponible.",
          inline: false
        },

        {
          name: "📦 +sstok 100",
          value: "Busca items con 100 stock total.",
          inline: false
        },

        {
          name: "🔄 +loop [canalId]",
          value: "Activa detección automática de nuevos items.",
          inline: false
        },

        {
          name: "🛑 +stop",
          value: "Detiene el loop automático.",
          inline: false
        },

        {
          name: "📢 +anunciar <itemId> <#canal> <título>",
          value:
`Busca el accesorio por ID y lo anuncia en el canal.
Ejemplo:
\`+anunciar 123456789 #ugc-free 🔥 ITEM GRATIS!\``,
          inline: false
        }

      )
      .setColor(0xff0000)
      .setFooter({ text: "Jory 😈" });

    return message.reply({ embeds: [embed] });

  }

  // ══════════════════════════════
  // +actual
  // ══════════════════════════════

  if (message.content.startsWith("+actual")) {

    const args = message.content.split(" ");
    const amount = parseInt(args[1]) || 1;
    const items = await getItems();

    if (!items) return message.reply("❌ Error obteniendo items");

    items.sort((a, b) => b.timestamp - a.timestamp);

    for (const item of items.slice(0, amount)) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

    return;

  }

  // ══════════════════════════════
  // +sstok
  // ══════════════════════════════

  if (message.content.startsWith("+sstok")) {

    const args = message.content.split(" ");
    const stock = parseInt(args[1]);

    if (!stock) return message.reply("❌ Usa: +sstok 100");

    const items = await getItems();
    if (!items) return;

    const filtered = items.filter(x => x.totalStock === stock);

    if (filtered.length === 0) return message.reply("❌ No encontrados");

    for (const item of filtered.slice(0, 10)) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

    return;

  }

  // ══════════════════════════════
  // +stok
  // ══════════════════════════════

  if (message.content.startsWith("+stok")) {

    const args = message.content.split(" ");
    const stock = parseInt(args[1]);

    if (!stock) return message.reply("❌ Usa: +stok 100");

    const items = await getItems();
    if (!items) return;

    const filtered = items.filter(x => x.availableStock === stock);

    if (filtered.length === 0) return message.reply("❌ No encontrados");

    for (const item of filtered.slice(0, 10)) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

    return;

  }

  // ══════════════════════════════
  // +loop
  // ══════════════════════════════

  if (message.content.startsWith("+loop")) {

    const args = message.content.split(" ");
    const channelId = args[1] || message.channel.id;

    loopEnabled = true;
    loopChannel = channelId;
    sentItems.clear();

    return message.reply(`🔥 Loop activado 😈\nCanal: ${channelId}`);

  }

  // ══════════════════════════════
  // +stop
  // ══════════════════════════════

  if (message.content === "+stop") {

    loopEnabled = false;
    loopChannel = null;

    return message.reply("🛑 Loop detenido 😈");

  }

  // ══════════════════════════════
  // +anunciar
  // ══════════════════════════════

  if (message.content.startsWith("+anunciar")) {

    const args = message.content.split(" ");

    const itemId = args[1];

    if (!itemId) {
      return message.reply(
`❌ Falta el ID del item.
Uso: \`+anunciar <itemId> <#canal> <título>\`
Ejemplo: \`+anunciar 123456789 #ugc-free 🔥 ITEM GRATIS!\``
      );
    }

    const rawChannel = args[2];

    if (!rawChannel) {
      return message.reply(
`❌ Falta el canal.
Uso: \`+anunciar <itemId> <#canal> <título>\``
      );
    }

    const channelId = rawChannel.replace(/[<#>]/g, "");

    const titulo = args.slice(3).join(" ");

    if (!titulo) {
      return message.reply(
`❌ Falta el título del anuncio.
Uso: \`+anunciar <itemId> <#canal> <título>\`
Ejemplo: \`+anunciar 123456789 #ugc-free 🔥 ITEM GRATIS POR TIEMPO LIMITADO!\``
      );
    }

    const loadingMsg = await message.reply("🔍 Buscando item en Rolimons...");

    const item = await getItemById(itemId);

    if (!item) {
      return loadingMsg.edit(
        `❌ No encontré el item con ID \`${itemId}\` en Rolimons.\nVerifica que el ID sea correcto.`
      );
    }

    let targetChannel;

    try {

      targetChannel = await client.channels.fetch(channelId);

    } catch (err) {

      return loadingMsg.edit(
        `❌ No pude encontrar el canal \`${channelId}\`.\nVerifica el ID o la mención.`
      );

    }

    try {

      const announceEmbed = createAnnouncementEmbed(item, titulo);

      await targetChannel.send({ embeds: [announceEmbed] });

      return loadingMsg.edit(
        `✅ Anuncio de **${item.name}** enviado a <#${channelId}> 😈`
      );

    } catch (err) {

      console.error("❌ Error enviando anuncio:", err);

      return loadingMsg.edit(
        `❌ No pude enviar en <#${channelId}>. Verifica que el bot tenga permisos en ese canal.`
      );

    }

  }

});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
