// StarMate Backend - Couples Version
// Dependencies: npm install express stripe nodemailer @napi-rs/canvas astronomy-engine dotenv cors

require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const astronomy = require('astronomy-engine');
const cors = require('cors');
console.log("🔑 Stripe key (first 10 chars):", process.env.STRIPE_SECRET_KEY?.slice(0, 10));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Function to format date with ordinal suffix (e.g., "May 12th, 2012")
function formatDateWithOrdinal(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC'
  };
  
  const formatted = date.toLocaleDateString('en-US', options);
  const dayNum = day;
  let suffix = 'th';
  if (dayNum % 10 === 1 && dayNum !== 11) suffix = 'st';
  else if (dayNum % 10 === 2 && dayNum !== 12) suffix = 'nd';
  else if (dayNum % 10 === 3 && dayNum !== 13) suffix = 'rd';
  
  return formatted.replace(/(\d+)/, `$1${suffix}`);
}

// Enhanced function to get moon phase name and description for couples
function getMoonPhaseInfo(moonPhase) {
  let phaseName = '';
  let phaseDescription = '';
  
  if (moonPhase < 0.125) {
    phaseName = 'New Moon';
    phaseDescription = 'new beginnings and fresh starts, symbolizing the beautiful journey you were about to embark on together';
  } else if (moonPhase < 0.375) {
    phaseName = 'Waxing Crescent';
    phaseDescription = 'growth and intention, indicating your love would flourish and deepen with each passing day';
  } else if (moonPhase < 0.625) {
    phaseName = 'First Quarter';
    phaseDescription = 'action and commitment, suggesting your relationship would be filled with decisive moments and shared adventures';
  } else if (moonPhase < 0.875) {
    phaseName = 'Waxing Gibbous';
    phaseDescription = 'anticipation and refinement, showing that your hearts were preparing for the completeness you would find in each other';
  } else if (moonPhase < 1.125) {
    phaseName = 'Full Moon';
    phaseDescription = 'illumination and fulfillment, representing the wholeness and radiance your union would bring';
  } else if (moonPhase < 1.375) {
    phaseName = 'Waning Gibbous';
    phaseDescription = 'gratitude and sharing, indicating the abundant love and wisdom you would cultivate together';
  } else if (moonPhase < 1.625) {
    phaseName = 'Last Quarter';
    phaseDescription = 'reflection and letting go, suggesting you would help each other heal and grow stronger';
  } else {
    phaseName = 'Waning Crescent';
    phaseDescription = 'surrender and rest, indicating the peace and comfort you would find in each other\'s presence';
  }
  
  return { phaseName, phaseDescription };
}

// Geocoding function
async function getCoordinates(location) {
  try {
    console.log(`📍 Geocoding location: ${location}`);
    const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${process.env.OPENCAGE_API_KEY}`);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return { latitude: lat, longitude: lng };
    }
    throw new Error('Location not found');
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

function calculateStarPositions(date, latitude, longitude) {
  const observer = new astronomy.Observer(latitude, longitude, 0);
  const time = new astronomy.AstroTime(date);

  const stars = [
    { name: 'Sirius', ra: 101.287, dec: -16.716 },
    { name: 'Canopus', ra: 95.988, dec: -52.696 },
    { name: 'Arcturus', ra: 213.915, dec: 19.182 },
    { name: 'Vega', ra: 279.234, dec: 38.784 },
    { name: 'Capella', ra: 79.172, dec: 45.998 },
    { name: 'Rigel', ra: 78.634, dec: -8.202 },
    { name: 'Procyon', ra: 114.825, dec: 5.225 },
    { name: 'Betelgeuse', ra: 88.793, dec: 7.407 },
    { name: 'Aldebaran', ra: 68.980, dec: 16.509 },
    { name: 'Spica', ra: 201.298, dec: -11.161 },
    { name: 'Antares', ra: 247.352, dec: -26.432 },
    { name: 'Pollux', ra: 116.329, dec: 28.026 },
    { name: 'Deneb', ra: 310.358, dec: 45.280 },
    { name: 'Regulus', ra: 152.093, dec: 11.967 }
  ];

  const visibleStars = stars.map(star => {
    const horizontal = astronomy.Horizon(time, observer, star.ra, star.dec, 'normal');
    return {
      ...star,
      altitude: horizontal.altitude,
      azimuth: horizontal.azimuth,
      visible: horizontal.altitude > 0
    };
  }).filter(star => star.visible);

  const moonVector = astronomy.GeoMoon(time);
  const moonEqu = astronomy.EquatorFromVector(moonVector);
  const moonHorizontal = astronomy.Horizon(time, observer, moonEqu.ra, moonEqu.dec, 'normal');  
  
  const planets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map(planetName => {
    const planet = astronomy.GeoVector(planetName, time, false);
    const equatorial = astronomy.EquatorFromVector(planet);
    const horizontal = astronomy.Horizon(time, observer, equatorial.ra, equatorial.dec, 'normal');
    return {
      name: planetName,
      altitude: horizontal.altitude,
      azimuth: horizontal.azimuth,
      visible: horizontal.altitude > 0
    };
  }).filter(planet => planet.visible);

  return {
    stars: visibleStars,
    moon: {
      altitude: moonHorizontal.altitude,
      azimuth: moonHorizontal.azimuth,
      phase: astronomy.MoonPhase(time),
      visible: moonHorizontal.altitude > 0
    },
    planets: planets,
    date: date.toISOString(),
    location: { latitude, longitude }
  };
}

function generateCosmicReading(skyData, name1, name2, specialDate) {
  const formattedDate = formatDateWithOrdinal(specialDate);
  
  let reading = `On ${formattedDate}, when ${name1} and ${name2}'s hearts aligned, the cosmos celebrated in a truly remarkable way.\n\n`;

  // List visible celestial objects
  if (skyData.stars.length > 0) {
    reading += `That night, ${skyData.stars.length} brilliant stars graced the sky: ${skyData.stars.map(s => s.name).join(', ')}. `;
  }
  
  if (skyData.planets.length > 0) {
    reading += `${skyData.planets.length} planet${skyData.planets.length > 1 ? 's' : ''} were also visible: ${skyData.planets.map(p => p.name).join(', ')}. `;
  }
  
  if (skyData.moon && skyData.moon.visible) {
    reading += `The Moon was present, bathing the earth in its gentle, romantic glow.`;
  }
  
  reading += '\n\n';

  // Featured stars with romantic descriptions
  const priorityStars = ['Sirius', 'Vega', 'Arcturus', 'Betelgeuse', 'Aldebaran', 'Spica', 'Antares', 'Deneb', 'Regulus'];
  const featuredStars = skyData.stars
    .filter(star => priorityStars.includes(star.name))
    .sort((a, b) => b.altitude - a.altitude)
    .slice(0, 3);

  if (featuredStars.length > 0) {
    reading += `Among these celestial guardians, three stars shone with particular significance:\n\n`;
    
    featuredStars.forEach(star => {
      switch (star.name) {
        case 'Sirius':
          reading += `<b>Sirius</b>, the brightest star in the night sky, blessed your union with its brilliant light, symbolizing unwavering devotion and eternal loyalty.\n\n`;
          break;
        case 'Vega':
          reading += `<b>Vega</b>, the harp star, sang celestial melodies of harmony and grace, promising your love would create beautiful music together.\n\n`;
          break;
        case 'Arcturus':
          reading += `<b>Arcturus</b>, the guardian star, watched over your union, ensuring protection and strength throughout your journey together.\n\n`;
          break;
        case 'Betelgeuse':
          reading += `<b>Betelgeuse</b>, the giant's shoulder, glowed with warm orange light, blessing your relationship with passion and adventure.\n\n`;
          break;
        case 'Aldebaran':
          reading += `<b>Aldebaran</b>, the follower, marked your path with its steady red glow, symbolizing faithfulness and unwavering commitment.\n\n`;
          break;
        case 'Spica':
          reading += `<b>Spica</b>, the wheat sheaf, promised abundance and prosperity in your life together.\n\n`;
          break;
        case 'Antares':
          reading += `<b>Antares</b>, the rival of Mars, blazed red in the sky, gifting your union with courage and bold hearts.\n\n`;
          break;
        case 'Deneb':
          reading += `<b>Deneb</b>, the distant beacon, shone its light across vast distances, symbolizing the enduring and timeless nature of your love.\n\n`;
          break;
        case 'Regulus':
          reading += `<b>Regulus</b>, the heart of the lion, bestowed your relationship with nobility and regal strength.\n\n`;
          break;
      }
    });
  }

  // Featured planets with romantic descriptions
  const featuredPlanets = skyData.planets
    .sort((a, b) => b.altitude - a.altitude)
    .slice(0, 2);

  if (featuredPlanets.length > 0) {
    reading += `The planetary influences were equally meaningful:\n\n`;
    
    featuredPlanets.forEach(planet => {
      switch (planet.name) {
        case 'Jupiter':
          reading += `<b>Jupiter</b>, the great benefactor, cast its protective influence over your union, promising good fortune and joy in your shared journey.\n\n`;
          break;
        case 'Venus':
          reading += `<b>Venus</b>, the planet of love, illuminated the deep affection and romance that would flourish between you.\n\n`;
          break;
        case 'Mars':
          reading += `<b>Mars</b>, the red planet, endowed your relationship with passion, energy, and an adventurous spirit.\n\n`;
          break;
        case 'Saturn':
          reading += `<b>Saturn</b>, the teacher, blessed your union with patience, wisdom, and bonds that would stand the test of time.\n\n`;
          break;
        case 'Mercury':
          reading += `<b>Mercury</b>, the swift messenger, gifted you with clear communication and understanding in your relationship.\n\n`;
          break;
      }
    });
  }

  // Moon phase interpretation
  if (skyData.moon) {
    const moonPhaseInfo = getMoonPhaseInfo(skyData.moon.phase);
    
    if (skyData.moon.visible) {
      reading += `The <b>${moonPhaseInfo.phaseName}</b> illuminated your special moment, representing ${moonPhaseInfo.phaseDescription}.\n\n`;
    } else {
      reading += `Though the <b>${moonPhaseInfo.phaseName}</b> was not visible that night, its hidden influence represented ${moonPhaseInfo.phaseDescription}.\n\n`;
    }
  }

  reading += `This unique celestial arrangement will never occur again in exactly the same way, making your star map a truly one-of-a-kind cosmic fingerprint of the night your hearts aligned.`;

  return reading;
}

// Helper functions for positioning
function checkOverlap(x, y, width, height, existingObjects, minDistance = 50) {
  for (let obj of existingObjects) {
    const distance = Math.sqrt((x - obj.x) ** 2 + (y - obj.y) ** 2);
    if (distance < minDistance) return true;
  }
  if (x < 20 || x > width - 100 || y < 40 || y > height - 40) return true;
  return false;
}

function findNonOverlappingPosition(baseX, baseY, width, height, existingObjects, maxAttempts = 50) {
  if (!checkOverlap(baseX, baseY, width, height, existingObjects)) {
    return { x: baseX, y: baseY };
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const radius = 30 + (attempt * 15);
    const angleStep = Math.PI / 6;
    
    for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
      const newX = baseX + radius * Math.cos(angle);
      const newY = baseY + radius * Math.sin(angle);
      
      if (!checkOverlap(newX, newY, width, height, existingObjects)) {
        return { x: newX, y: newY };
      }
    }
  }
  
  const fallbackX = Math.random() * (width - 200) + 100;
  const fallbackY = Math.random() * (height - 200) + 100;
  return { x: fallbackX, y: fallbackY };
}

async function generateCosmicReadingImage(reading, name1, name2, skyData) {
  const width = 800;
  const height = 1400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Romantic gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.3, '#16213e');
  gradient.addColorStop(0.7, '#0f3460');
  gradient.addColorStop(1, '#0a1930');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Twinkling stars background
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.5 + 0.5;
    const opacity = Math.random() * 0.6 + 0.2;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.shadowBlur = 2;
    ctx.shadowColor = 'white';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Title
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center';
  
  const starImage = await loadImage('./public/star.png');
  const titleText = `${name1} & ${name2}'s Cosmic Reading`;
  const titleWidth = ctx.measureText(titleText).width;
  const starSize = 28;

  ctx.drawImage(starImage, width / 2 - titleWidth / 2 - starSize - 10, 60 - starSize + 5, starSize, starSize);
  ctx.fillText(titleText, width / 2, 60);
  ctx.drawImage(starImage, width / 2 + titleWidth / 2 + 10, 60 - starSize + 5, starSize, starSize);

  // Decorative line
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 150, 80);
  ctx.lineTo(width / 2 + 150, 80);
  ctx.stroke();

  // Render reading text
  const lines = reading.split('\n').filter(line => line.trim() !== '');
  let y = 120;
  const lineHeight = 24;
  const maxWidth = width - 80;

  lines.forEach(line => {
    let textColor = '#E6E6FA';
    let font = '16px Georgia, serif';
    let cleanLine = line;

    let isMoonLine = line.includes('Moon') && (line.includes('illuminated') || line.includes('represented') || line.includes('hidden influence'));

    if (line.includes('<b>') && line.includes('</b>')) {
      font = 'bold 18px Georgia, serif';
      cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
    }

    if (isMoonLine) {
      textColor = '#8B6914';
    } else if (line.includes('<b>')) {
      if (line.includes('Moon') || line.includes('Crescent') || line.includes('Quarter') || line.includes('Gibbous') || line.includes('Full')) {
        textColor = '#8B6914';
      } else {
        textColor = '#FFD700';
      }
    } else {
      textColor = '#E6E6FA';
    }

    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';

    const words = cleanLine.split(' ');
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine + word + ' ';
      const testWidth = ctx.measureText(testLine).width;
      
      if (testWidth > maxWidth && currentLine !== '') {
        ctx.fillText(currentLine.trim(), 40, y);
        currentLine = word + ' ';
        y += lineHeight;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine.trim() !== '') {
      ctx.fillText(currentLine.trim(), 40, y);
    }
    
    y += lineHeight + 8;
  });

  // Bottom decorative element
  ctx.fillStyle = '#FFD700';
  ctx.font = '20px Georgia, serif';
  ctx.textAlign = 'center';
  const bottomText = 'A Love Written in the Stars';
  const bottomTextWidth = ctx.measureText(bottomText).width;
  const bottomStarSize = 20;

  ctx.drawImage(starImage, width / 2 - bottomTextWidth / 2 - bottomStarSize - 10, height - 30 - bottomStarSize + 5, bottomStarSize, bottomStarSize);
  ctx.fillText(bottomText, width / 2, height - 30);
  ctx.drawImage(starImage, width / 2 + bottomTextWidth / 2 + 10, height - 30 - bottomStarSize + 5, bottomStarSize, bottomStarSize);

  return canvas.toBuffer('image/png');
}

async function generateStarMap(skyData, name1, name2, specialDate, customMessage) {
  const width = 800;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Night sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0a0a23');
  gradient.addColorStop(1, '#000010');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Background stars
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
    ctx.fill();
  }

  const existingObjects = [];

  // Draw stars
  skyData.stars.forEach(star => {
    const radius = (90 - star.altitude) / 90 * (width / 2 - 50);
    const angle = (star.azimuth - 90) * Math.PI / 180;
    const baseX = width / 2 + radius * Math.cos(angle);
    const baseY = height / 2 + radius * Math.sin(angle);

    const position = findNonOverlappingPosition(baseX, baseY, width, height, existingObjects);
    
    const size = 2.5;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size, 0, 2 * Math.PI);
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'white';
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffd700';
    ctx.font = '12px serif';
    ctx.textAlign = 'left';
    ctx.fillText(star.name, position.x + 8, position.y - 8);

    existingObjects.push({ x: position.x, y: position.y, type: 'star', name: star.name });
  });

  // Draw planets
  skyData.planets.forEach(planet => {
    const radius = (90 - planet.altitude) / 90 * (width / 2 - 50);
    const angle = (planet.azimuth - 90) * Math.PI / 180;
    const baseX = width / 2 + radius * Math.cos(angle);
    const baseY = height / 2 + radius * Math.sin(angle);

    const position = findNonOverlappingPosition(baseX, baseY, width, height, existingObjects);

    ctx.beginPath();
    ctx.arc(position.x, position.y, 4, 0, 2 * Math.PI);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffa500';
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = '12px serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'left';
    ctx.fillText(planet.name, position.x + 8, position.y - 8);

    existingObjects.push({ x: position.x, y: position.y, type: 'planet', name: planet.name });
  });

  // Draw moon
  if (skyData.moon) {
    const radius = (90 - Math.abs(skyData.moon.altitude)) / 90 * (width / 2 - 50);
    const angle = (skyData.moon.azimuth - 90) * Math.PI / 180;
    const baseX = width / 2 + radius * Math.cos(angle);
    const baseY = height / 2 + radius * Math.sin(angle);

    const position = findNonOverlappingPosition(baseX, baseY, width, height, existingObjects);
    
    if (skyData.moon.visible) {
      ctx.fillStyle = '#e6e6e6';
      ctx.beginPath();
      ctx.arc(position.x, position.y, 6, 0, 2 * Math.PI);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = '#cccccc';
      ctx.font = '12px serif';
      ctx.textAlign = 'left';
      ctx.fillText('Moon', position.x + 10, position.y - 10);
    } else {
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(position.x, position.y, 6, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#666666';
      ctx.font = '10px serif';
      ctx.textAlign = 'left';
      ctx.fillText('Moon', position.x + 10, position.y - 10);
    }

    existingObjects.push({ x: position.x, y: position.y, type: 'moon', name: 'Moon' });
  }

  // Cardinal directions
  ctx.fillStyle = '#dddddd';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', width / 2, 52);
  ctx.fillText('S', width / 2, height - 15);
  ctx.fillText('E', width - 20, height / 2);
  ctx.fillText('W', 20, height / 2);

  // Top label with hearts
  const formattedDate = formatDateWithOrdinal(specialDate);
  const textStartX = 20;
  const textY = 30;
  const heartSize = 24;
  
  const heart = await loadImage('./public/heart.png');
  ctx.drawImage(heart, textStartX, textY - heartSize + 5, heartSize, heartSize);
  
  const firstLine = `${name1} & ${name2}`;
  const secondLine = customMessage || `${formattedDate}`;

  ctx.font = 'italic bold 16px Georgia, serif';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'left';

  ctx.fillText(firstLine, textStartX + 30, textY);
  ctx.fillText(secondLine, textStartX + 30, textY + 20);

  return canvas.toBuffer('image/png');
}

// Temporary storage
const tempUserData = {};

app.post('/create-checkout-session', async (req, res) => {
  const { yourName, partnerName, specialDate, location, customMessage, email } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price: process.env.STRIPE_PRICE_ID, // Use your StarMate price ID
        quantity: 1
      }],
      success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/star_form.html`,
      metadata: { yourName, partnerName, specialDate, location, customMessage, email }
    });

    tempUserData[session.id] = { yourName, partnerName, specialDate, location, customMessage, email };

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/api/generate-starmap', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userData = tempUserData[sessionId];
    
    if (!userData) return res.status(400).json({ error: 'Session not found.' });

    const { yourName, partnerName, email, specialDate, location, customMessage } = userData;

    if (!location || typeof location !== 'string' || location.trim() === '') {
      return res.status(400).json({ error: 'Location is required.' });
    }

    console.log("📍 Geocoding location:", location);

    const coordinates = await getCoordinates(location);
    const dateObj = new Date(specialDate);
    const skyData = calculateStarPositions(dateObj, coordinates.latitude, coordinates.longitude);
    
    const reading = generateCosmicReading(skyData, yourName, partnerName, specialDate);
    
    const starMapImage = await generateStarMap(skyData, yourName, partnerName, specialDate, customMessage);
    const readingImage = await generateCosmicReadingImage(reading, yourName, partnerName, skyData);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your StarMate Map is Here! 💝`,
      html: `
        <div style="text-align: center; font-family: Georgia, serif; background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px; color: #E6E6FA;">
          <h2 style="color: #FFD700; margin-bottom: 20px;">💫 Your Personalized Star Map Has Arrived! 💫</h2>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            ${yourName} and ${partnerName}'s cosmic reading and star map are attached below. Each image tells the unique story of the celestial alignment on the night your hearts came together.
          </p>
          <p style="font-style: italic; color: #87CEEB;">
            "The stars aligned perfectly for your love" ✨
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `${yourName}_${partnerName}_cosmic_reading.png`,
          content: readingImage,
          cid: 'cosmic_reading'
        },
        {
          filename: `${yourName}_${partnerName}_star_map.png`,
          content: starMapImage,
          cid: 'star_map'
        }
      ]
    });

    delete tempUserData[sessionId];
    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log('StarMate API server running on port', process.env.PORT || 3001);
});