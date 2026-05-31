const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['CHANNEL'],
});

// ============================================================
// CONFIGURACIÓN — CAMBIA SOLO ESTAS 2 LÍNEAS
const TOKEN = process.env.TOKEN;
const WELCOME_CHANNEL_ID = process.env.CHANNEL_ID;
// ============================================================

const pendingMembers = new Map();

client.once('ready', () => {
  console.log(`✅ Ghost está online: ${client.user.tag}`);
});

// Cuando alguien nuevo entra al servidor
client.on('guildMemberAdd', async (member) => {
  try {
    pendingMembers.set(member.id, {
      member,
      step: 1,
      nombre: '',
      region: '',
      especialidad: '',
    });

    await member.send(
      `☠️ **COVENANT — REGISTRO DE OPERATIVO**\n\n` +
      `Bienvenido, soldado. Antes de acceder necesito registrar tus datos.\n\n` +
      `**[1/3]** ¿Cuál es tu **nombre en el campo de batalla**?`
    );
  } catch (err) {
    console.log(`No se pudo enviar DM a ${member.user.tag}`);
  }
});

// Escuchar respuestas por DM
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.guild) return;

  const userId = message.author.id;
  const data = pendingMembers.get(userId);
  if (!data) return;

  if (data.step === 1) {
    data.nombre = message.content.trim().toUpperCase();
    data.step = 2;
    pendingMembers.set(userId, data);

    await message.reply(
      `✅ Nombre: **${data.nombre}**\n\n` +
      `**[2/3]** ¿De qué **región** eres?\n\n` +
      `Ejemplos: \`España\`, \`México\`, \`Colombia\`, \`Argentina\`, \`Venezuela\`, \`LATAM\`, \`EU\``
    );

  } else if (data.step === 2) {
    data.region = message.content.trim().toUpperCase();
    data.step = 3;
    pendingMembers.set(userId, data);

    await message.reply(
      `✅ Región: **${data.region}**\n\n` +
      `**[3/3]** ¿Cuál es tu **especialidad**?\n\n` +
      `🎯 \`Francotirador\`\n` +
      `⚔️ \`Asalto\`\n` +
      `🛡️ \`Defensa\`\n` +
      `💊 \`Médico\`\n` +
      `💣 \`Demoliciones\`\n` +
      `🕵️ \`Infiltración\``
    );

  } else if (data.step === 3) {
    data.especialidad = message.content.trim().toUpperCase();
    pendingMembers.delete(userId);

    await message.reply(`🎖️ Registro completado. Generando tu placa de operativo...`);

    try {
      const imageBuffer = await generarPlaca(data.member, data.nombre, data.region, data.especialidad);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'placa.png' });

      // Enviar al canal de bienvenida
      const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xD4A017)
          .setDescription(
            `🎖️ **NUEVO OPERATIVO REGISTRADO**\n` +
            `<@${data.member.id}> se ha unido a las filas de COVENANT.\n` +
            `¡Bienvenido al frente, soldado!`
          );
        await channel.send({ embeds: [embed], files: [attachment] });
      }

      // Enviar placa por DM también
      await message.author.send({
        content: `🎖️ **Tu placa de COVENANT está lista.**\nGuárdala bien, operativo.`,
        files: [attachment],
      });

    } catch (err) {
      console.error('Error generando placa:', err);
      await message.reply('⚠️ Error al generar la placa. Contacta a un administrador.');
    }
  }
});

async function generarPlaca(member, nombre, region, especialidad) {
  const WIDTH = 1774;
  const HEIGHT = 887;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fondo — la placa
  const background = await loadImage(path.join(__dirname, 'placa.png'));
  ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);

  // Datos dinámicos
  const memberCount = member.guild.memberCount;
  const idSoldado = `#${String(memberCount).padStart(4, '0')}`;
  const fecha = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Estilo del texto
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Arial';
  ctx.textBaseline = 'middle';

  // Coordenadas exactas de cada campo (después de las etiquetas)
  const campoX = 660;
  ctx.fillText(nombre,       campoX, 350);  // NOMBRE
  ctx.fillText('RECLUTA',    campoX, 432);  // RANGO (inicial siempre Recluta)
  ctx.fillText(region,       campoX, 512);  // REGIÓN
  ctx.fillText(especialidad, campoX, 592);  // ESPECIALIDAD
  ctx.fillText(idSoldado,    campoX, 672);  // ID
  ctx.fillText(fecha,        campoX, 752);  // FECHA DE INGRESO

  // Avatar en el círculo
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarURL);

    const cx = 1464;
    const cy = 390;
    const r = 155;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } catch (err) {
    console.log('Avatar no disponible:', err.message);
  }

  return canvas.toBuffer('image/png');
}

client.login(TOKEN);