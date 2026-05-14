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

  try {

    const response =
      await fetch("https://www.rolimons.com/free-roblox-limiteds");

    const html =
      await response.text();

    const match =
      html.match(/item_details\s*=\s*(\{[\s\S]*?\});/);

    if (!match) {
      console.log("❌ item_details no encontrado");
      return null;
    }

    let data;

    try {
      data = JSON.parse(match[1]);
    } catch (err) {
      console.log("❌ Error parseando JSON:", err);
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

  } catch (err) {

    console.log("❌ Error obteniendo items:", err);
    return null;

  }

}

// =====================
// GET ITEM BY ID
// =====================

async function getItemById(itemId) {

  const items =
    await getItems();

  if (!items)
    return null;

  return items.find(x => x.id === itemId) || null;

}

// =====================
// SEARCH ITEMS
// =====================

async function searchItems(query) {

  const items =
    await getItems();

  if (!items)
    return null;

  const cleanQuery =
    query.toLowerCase().trim();

  const exactId =
    items.find(x => x.id === query.trim());

  if (exactId)
    return [exactId];

  const exactName =
    items.filter(x =>
      x.name.toLowerCase() === cleanQuery
    );

  if (exactName.length > 0)
    return exactName;

  return items.filter(x =>
    x.name.toLowerCase().includes(cleanQuery)
  );

}

// =====================
// GET UNIVERSE ID
// =====================

async function getUniverseIdFromPlaceId(placeId) {

  try {

    console.log("🔍 Buscando universeId para:", placeId);

    const res = await fetch(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );

    if (!res.ok) {

      console.log("❌ Universe API status:", res.status);

      return null;

    }

    const data =
      await res.json();

    console.log("✅ Universe data:", data);

    return data?.universeId || null;

  } catch (err) {

    console.log("❌ Error obteniendo universeId:", err);

    return null;

  }

}

// =====================
// EVENTS
// =====================

async function getExperienceEvents(placeId) {

  try {

    console.log("🎮 PlaceId:", placeId);

    const universeId =
      await getUniverseIdFromPlaceId(placeId);

    console.log("🌎 UniverseId:", universeId);

    if (!universeId)
      return null;

    const now =
      new Date();

    const fromUtc =
      new Date(
        now.getTime() - 1000 * 60 * 60 * 24 * 30
      ).toISOString();

    const toUtc =
      new Date(
        now.getTime() + 1000 * 60 * 60 * 24 * 60
      ).toISOString();

    const url =
`https://apis.roblox.com/virtual-events/v1/virtual-events?fromUtc=${encodeURIComponent(fromUtc)}&toUtc=${encodeURIComponent(toUtc)}&universeIds=${universeId}`;

    console.log("🌐 Events URL:", url);

    const res =
      await fetch(url);

    console.log("📡 Events status:", res.status);

    if (!res.ok)
      return null;

    const data =
      await res.json();

    console.log(
      "✅ Events data:",
      JSON.stringify(data).slice(0, 2000)
    );

    const events =
      data?.data || [];

    if (!events.length) {

      console.log("❌ No events");

      return null;

    }

    const event =
      events[0];

    console.log("🔥 Event found:", event.title);

    return {

      title:
        event.title ||
        event.displayTitle ||
        "Evento sin título",

      subtitle:
        event.subtitle ||
        "Sin subtítulo",

      description:
        event.description ||
        event.displayDescription ||
        "Sin descripción",

      startTime:
        event.eventTime?.startUtc ||
        null,

      endTime:
        event.eventTime?.endUtc ||
        null

    };

  } catch (err) {

    console.log(
      "❌ Error obteniendo eventos:",
      err
    );

    return null;

  }

}

// =====================
// FORMAT DATE
// =====================

function formatEventDate(value) {

  if (!value)
    return "Sin datos";

  const date =
    new Date(value);

  if (isNaN(date.getTime()))
    return "Sin datos";

  return date.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

}

// =====================
// EMBED
// =====================

async function createItemEmbed(item) {

  const gameText =
    item.games?.length
      ? item.games
          .map(g =>
            `[${g.name}](https://www.roblox.com/games/${g.game_id})`
          )
          .join("\n")
      : "Unknown";

  const firstGameId =
    item.games?.[0]?.game_id;

  console.log("🎯 Game ID:", firstGameId);

  const eventData =
    firstGameId
      ? await getExperienceEvents(firstGameId)
      : null;

  console.log("📅 EventData:", eventData);

  const eventText =
    eventData
      ? `**${eventData.title}**
${eventData.subtitle}

🕒 ${formatEventDate(eventData.startTime)} - ${formatEventDate(eventData.endTime)}

${eventData.description}`
      : "Sin datos de eventos";

  return new EmbedBuilder()

    .setTitle(item.name.toUpperCase())

    .setURL(
      `https://www.roblox.com/catalog/${item.id}`
    )

    .setThumbnail(item.thumbnail)

    .setImage(
      item.thumbnail.replace(
        "/150/150/",
        "/420/420/"
      )
    )

    .setDescription(
`# 📦 STOCK
# ${item.availableStock}/${item.totalStock}`
    )

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
        value:
`https://www.roblox.com/catalog/${item.id}`,
        inline: false
      },
      {
        name: "🆔 ID",
        value: `\`${item.id}\``,
        inline: false
      }
    )

    .setColor(0xff0000)

    .setFooter({
      text: "Jory 😈"
    });

}

// =====================
// ANNOUNCEMENT EMBED
// =====================

function createAnnouncementEmbed(item, titulo) {

  return new EmbedBuilder()

    .setTitle(titulo)

    .setDescription(
`## ${item.name}

# 📦 STOCK
# ${item.availableStock}/${item.totalStock}`
    )

    .setImage(
      item.thumbnail.replace(
        "/150/150/",
        "/420/420/"
      )
    )

    .setColor(0xff0000)

    .setFooter({
      text: "Jory 😈"
    });

}

// =====================
// LOOP
// =====================

setInterval(async () => {

  if (!loopEnabled)
    return;

  const items =
    await getItems();

  if (!items)
    return;

  items.sort((a, b) =>
    b.timestamp - a.timestamp
  );

  const newest =
    items[0];

  if (sentItems.has(newest.id))
    return;

  sentItems.add(newest.id);

  try {

    const channel =
      await client.channels.fetch(loopChannel);

    await channel.send({
      embeds: [
        await createItemEmbed(newest)
      ]
    });

    console.log(
      `🔥 Nuevo item enviado: ${newest.name}`
    );

  } catch (err) {

    console.log(err);

  }

}, 10000);

// =====================
// COMMANDS
// =====================

client.on("messageCreate", async (message) => {

  if (message.author.bot)
    return;

  if (
    message.content.startsWith("+") &&
    !message.member?.permissions?.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return message.reply(
      "❌ Solo administradores pueden usar este bot."
    );
  }

  console.log("💬", message.content);

  // =====================
  // PING
  // =====================

  if (message.content === "+ping") {
    return message.reply("🏓 Pong 😈");
  }

  // =====================
  // ACTUAL
  // =====================

  if (message.content.startsWith("+actual")) {

    const args =
      message.content.split(" ");

    const amount =
      parseInt(args[1]) || 1;

    const items =
      await getItems();

    if (!items)
      return message.reply(
        "❌ Error obteniendo items"
      );

    items.sort((a, b) =>
      b.timestamp - a.timestamp
    );

    for (const item of items.slice(0, amount)) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

    return;

  }

  // =====================
  // BUSCAR
  // =====================

  if (message.content.startsWith("+buscar")) {

    const query =
      message.content
        .replace("+buscar", "")
        .trim();

    if (!query) {
      return message.reply(
`❌ Usa:
\`+buscar <id o nombre>\``
      );
    }

    const loadingMsg =
      await message.reply(
        "🔎 Buscando item..."
      );

    const results =
      await searchItems(query);

    if (!results || results.length === 0) {

      return loadingMsg.edit(
        `❌ No encontré resultados para: \`${query}\``
      );

    }

    const limitedResults =
      results.slice(0, 5);

    await loadingMsg.edit(
`✅ Encontré ${results.length} resultado(s).`
    );

    for (const item of limitedResults) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

    return;

  }

  // =====================
  // STOCK
  // =====================

  if (message.content.startsWith("+stok")) {

    const args =
      message.content.split(" ");

    const stock =
      parseInt(args[1]);

    if (!stock)
      return message.reply(
        "❌ Usa: +stok 100"
      );

    const items =
      await getItems();

    if (!items)
      return;

    const filtered =
      items.filter(
        x => x.availableStock === stock
      );

    if (!filtered.length)
      return message.reply(
        "❌ No encontrados"
      );

    for (const item of filtered.slice(0, 10)) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

  }

  // =====================
  // TOTAL STOCK
  // =====================

  if (message.content.startsWith("+sstok")) {

    const args =
      message.content.split(" ");

    const stock =
      parseInt(args[1]);

    if (!stock)
      return message.reply(
        "❌ Usa: +sstok 100"
      );

    const items =
      await getItems();

    if (!items)
      return;

    const filtered =
      items.filter(
        x => x.totalStock === stock
      );

    if (!filtered.length)
      return message.reply(
        "❌ No encontrados"
      );

    for (const item of filtered.slice(0, 10)) {

      await message.channel.send({
        embeds: [
          await createItemEmbed(item)
        ]
      });

    }

  }

});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
