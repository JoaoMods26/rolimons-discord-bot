const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require("discord.js");

// =====================
// CLIENT
// =====================

const client = new Client({

  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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

client.once(
  "clientReady",
  () => {

    console.log(
`🔥 Bot online como ${client.user.tag}`
    );

  }
);

// =====================
// GET ITEMS
// =====================

async function getItems() {

  const response =
    await fetch(
"https://www.rolimons.com/free-roblox-limiteds"
    );

  const html =
    await response.text();

  const match =
    html.match(
/item_details\s*=\s*(\{[\s\S]*?\});/
    );

  if (!match) {

    console.log(
"❌ item_details no encontrado"
    );

    return null;

  }

  let data;

  try {

    data =
      JSON.parse(match[1]);

  } catch (err) {

    console.log(err);

    return null;

  }

  return Object.entries(data).map(
    ([id, item]) => ({

      id,

      name: item[0],

      timestamp: item[1],

      totalStock: item[2],

      availableStock: item[3],

      thumbnail: item[5],

      games: item[6]

    })
  );

}

// =====================
// CREATE EMBED
// =====================

function createItemEmbed(item) {

  return new EmbedBuilder()

    .setTitle(item.name)

    .setURL(
`https://www.roblox.com/catalog/${item.id}`
    )

    .setThumbnail(
      item.thumbnail
    )

    .setImage(
      item.thumbnail.replace(
        "/150/150/",
        "/420/420/"
      )
    )

    .addFields(

      {
        name:
          "📦 STOCK DISPONIBLE",
        value:
`# ${item.availableStock}`,
        inline: true
      },

      {
        name:
          "📦 STOCK TOTAL",
        value:
`# ${item.totalStock}`,
        inline: true
      },

      {
        name:
          "📊 STOCK",
        value:
`# ${item.availableStock}/${item.totalStock}`,
        inline: false
      },

      {
        name:
          "🎮 JUEGO",
        value:
item.games?.[0]?.name ||
"Unknown",
        inline: false
      },

      {
        name:
          "🔗 LINK",
        value:
`https://www.roblox.com/catalog/${item.id}`,
        inline: false
      }

    )

    .setColor(0xff0000)

    .setFooter({
      text:
"Rolimons Tracker 😈"
    });

}

// =====================
// LOOP CHECK
// =====================

setInterval(async () => {

  if (!loopEnabled)
    return;

  const items =
    await getItems();

  if (!items)
    return;

  items.sort(
    (a, b) =>
      b.timestamp -
      a.timestamp
  );

  const newest =
    items[0];

  if (
    sentItems.has(
      newest.id
    )
  ) {

    return;

  }

  sentItems.add(
    newest.id
  );

  try {

    const channel =
      await client.channels.fetch(
        loopChannel
      );

    const embed =
      createItemEmbed(
        newest
      );

    await channel.send({
      embeds: [embed]
    });

    console.log(
`🔥 Nuevo item enviado: ${newest.name}`
    );

  } catch (err) {

    console.log(err);

  }

}, 10000);

// =====================
// MESSAGES
// =====================

client.on(
  "messageCreate",
  async (message) => {

    if (message.author.bot)
      return;

    console.log(
      message.content
    );

    // =====================
    // +ping
    // =====================

    if (
      message.content ===
      "+ping"
    ) {

      return message.reply(
"🏓 Pong 😈"
      );

    }

    // =====================
    // +actual
    // =====================

    if (
      message.content.startsWith(
        "+actual"
      )
    ) {

      const args =
        message.content.split(" ");

      const amount =
        parseInt(args[1]) || 1;

      const items =
        await getItems();

      if (!items) {

        return message.reply(
"❌ Error obteniendo items"
        );

      }

      items.sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );

      const latest =
        items.slice(0, amount);

      for (const item of latest) {

        const embed =
          createItemEmbed(
            item
          );

        await message.channel.send({
          embeds: [embed]
        });

      }

    }

    // =====================
    // +stok
    // DISPONIBLES
    // =====================

    if (
      message.content.startsWith(
        "+stok"
      )
    ) {

      const args =
        message.content.split(" ");

      const stock =
        parseInt(args[1]);

      if (!stock) {

        return message.reply(
"❌ Usa: +stok 100"
        );

      }

      const items =
        await getItems();

      if (!items)
        return;

      const filtered =
        items.filter(
          x =>
            x.availableStock ===
            stock
        );

      if (
        filtered.length === 0
      ) {

        return message.reply(
"❌ No encontrados"
        );

      }

      for (const item of filtered.slice(0, 10)) {

        const embed =
          createItemEmbed(
            item
          );

        await message.channel.send({
          embeds: [embed]
        });

      }

    }

    // =====================
    // +sstok
    // TOTAL
    // =====================

    if (
      message.content.startsWith(
        "+sstok"
      )
    ) {

      const args =
        message.content.split(" ");

      const stock =
        parseInt(args[1]);

      if (!stock) {

        return message.reply(
"❌ Usa: +sstok 100"
        );

      }

      const items =
        await getItems();

      if (!items)
        return;

      const filtered =
        items.filter(
          x =>
            x.totalStock ===
            stock
        );

      if (
        filtered.length === 0
      ) {

        return message.reply(
"❌ No encontrados"
        );

      }

      for (const item of filtered.slice(0, 10)) {

        const embed =
          createItemEmbed(
            item
          );

        await message.channel.send({
          embeds: [embed]
        });

      }

    }

    // =====================
    // +loop
    // =====================

    if (
      message.content.startsWith(
        "+loop"
      )
    ) {

      const args =
        message.content.split(" ");

      const channelId =
        args[1] ||
        message.channel.id;

      loopEnabled = true;

      loopChannel =
        channelId;

      sentItems.clear();

      return message.reply(

`🔥 Loop activado 😈

Canal:
${channelId}`
      );

    }

    // =====================
    // +stop
    // =====================

    if (
      message.content ===
      "+stop"
    ) {

      loopEnabled = false;

      loopChannel = null;

      return message.reply(
"🛑 Loop detenido 😈"
      );

    }

  }
);

// =====================
// LOGIN
// =====================

client.login(TOKEN);