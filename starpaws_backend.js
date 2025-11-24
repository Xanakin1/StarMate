// StarPaws Backend - Enhanced Implementation with Fixed Star Display and No Overlapping
// Dependencies: npm install express stripe nodemailer canvas astronomy-engine dotenv cors

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
  // Parse the date string manually to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC' // Force UTC to prevent timezone shifts
  };
  
  const formatted = date.toLocaleDateString('en-US', options);
  
  // Add ordinal suffix to day
  const dayNum = day; // Use the original day from the string
  let suffix = 'th';
  if (dayNum % 10 === 1 && dayNum !== 11) suffix = 'st';
  else if (dayNum % 10 === 2 && dayNum !== 12) suffix = 'nd';
  else if (dayNum % 10 === 3 && dayNum !== 13) suffix = 'rd';
  
  return formatted.replace(/(\d+)/, `$1${suffix}`);
}

// Enhanced function to get moon phase name and description
function getMoonPhaseInfo(moonPhase) {
  let phaseName = '';
  let phaseDescription = '';
  
  if (moonPhase < 0.125) {
    phaseName = 'New Moon';
    phaseDescription = 'a fresh beginning, symbolizing new adventures and the start of your beautiful journey together';
  } else if (moonPhase < 0.375) {
    phaseName = 'Waxing Crescent';
    phaseDescription = 'growth and potential, indicating your bond would flourish and strengthen with each passing day';
  } else if (moonPhase < 0.625) {
    phaseName = 'First Quarter';
    phaseDescription = 'determination and action, suggesting your relationship would be filled with playful adventures and decisive moments';
  } else if (moonPhase < 0.875) {
    phaseName = 'Waxing Gibbous';
    phaseDescription = 'refinement and anticipation, showing that your perfect companion was almost ready to complete your world';
  } else if (moonPhase < 1.125) {
    phaseName = 'Full Moon';
    phaseDescription = 'complete radiance and fulfillment, suggesting they would bring wholeness and joy to your world';
  } else if (moonPhase < 1.375) {
    phaseName = 'Waning Gibbous';
    phaseDescription = 'gratitude and sharing, indicating the abundant love and wisdom your pet would bring to your life';
  } else if (moonPhase < 1.625) {
    phaseName = 'Last Quarter';
    phaseDescription = 'release and forgiveness, suggesting your pet would help heal old wounds and bring peace to your heart';
  } else {
    phaseName = 'Waning Crescent';
    phaseDescription = 'rest and reflection, indicating your pet would bring calming, contemplative moments to your busy life';
  }
  
  return { phaseName, phaseDescription};
}

// Geocoding function to get coordinates from location
async function getCoordinates(location) {
  try {
    console.log(`📍 Geocoding location: ${location}`);
    const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${process.env.OPENCAGE_API_KEY}`);
    const data = await response.json();
    console.log(`📦 Geocode API response: ${JSON.stringify(data)}`);

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

function generateCosmicReading(skyData, petName, adoptionDate) {
  const formattedDate = formatDateWithOrdinal(adoptionDate);
  
  let reading = `On ${formattedDate}, when ${petName} entered your life, the cosmos aligned in a truly special way.\n\n`;

  // List all visible celestial objects first
  if (skyData.stars.length > 0) {
    reading += `That night, ${skyData.stars.length} brilliant stars graced the sky: ${skyData.stars.map(s => s.name).join(', ')}. `;
  }
  
  if (skyData.planets.length > 0) {
    reading += `${skyData.planets.length} planet${skyData.planets.length > 1 ? 's' : ''} were also visible: ${skyData.planets.map(p => p.name).join(', ')}. `;
  }
  
  if (skyData.moon && skyData.moon.visible) {
    reading += `The Moon was present, casting its gentle light upon the earth.`;
  }
  
  reading += '\n\n';

  // Focus on 3 main stars with descriptions (only if visible)
  const priorityStars = ['Sirius', 'Vega', 'Arcturus', 'Betelgeuse', 'Aldebaran', 'Spica', 'Antares', 'Deneb', 'Regulus'];
  const featuredStars = skyData.stars
    .filter(star => priorityStars.includes(star.name))
    .sort((a, b) => b.altitude - a.altitude) // Sort by altitude (higher = more prominent)
    .slice(0, 3);

  if (featuredStars.length > 0) {
    reading += `Among these celestial guardians, three stars shone with particular significance:\n\n`;
    
    featuredStars.forEach(star => {
      switch (star.name) {
        case 'Sirius':
          reading += `<b>Sirius</b>, the brightest star in the night sky, blessed ${petName}'s arrival with its brilliant light, symbolizing loyalty and devotion.\n\n`;
          break;
        case 'Vega':
          reading += `<b>Vega</b>, the harp star, sang celestial melodies of harmony and grace, promising ${petName} would bring music to your heart.\n\n`;
          break;
        case 'Arcturus':
          reading += `<b>Arcturus</b>, the guardian of the bear, watched over ${petName}'s journey to you, ensuring protection and strength.\n\n`;
          break;
        case 'Betelgeuse':
          reading += `<b>Betelgeuse</b>, the giant's shoulder, glowed with warm orange light, blessing ${petName} with a spirited and adventurous nature.\n\n`;
          break;
        case 'Aldebaran':
          reading += `<b>Aldebaran</b>, the follower, marked ${petName}'s path with its steady red glow, symbolizing faithfulness and companionship.\n\n`;
          break;
        case 'Spica':
          reading += `<b>Spica</b>, the wheat sheaf, promised abundance and prosperity in the bond between you and ${petName}.\n\n`;
          break;
        case 'Antares':
          reading += `<b>Antares</b>, the rival of Mars, blazed red in the sky, gifting ${petName} with courage and a bold heart.\n\n`;
          break;
        case 'Deneb':
          reading += `<b>Deneb</b>, the distant beacon, shone its light across vast distances, symbolizing the enduring nature of your bond with ${petName}.\n\n`;
          break;
        case 'Regulus':
          reading += `<b>Regulus</b>, the heart of the lion, bestowed ${petName} with nobility and a regal spirit.\n\n`;
          break;
      }
    });
  }

  // Focus on 2 main planets with descriptions (only if visible)
  const featuredPlanets = skyData.planets
    .sort((a, b) => b.altitude - a.altitude) // Sort by prominence
    .slice(0, 2);

  if (featuredPlanets.length > 0) {
    reading += `The planetary influences were equally meaningful:\n\n`;
    
    featuredPlanets.forEach(planet => {
      switch (planet.name) {
        case 'Jupiter':
          reading += `<b>Jupiter</b>, the great benefactor, cast its protective influence over ${petName}, promising good fortune and joy in your shared journey.\n\n`;
          break;
        case 'Venus':
          reading += `<b>Venus</b>, the planet of love, illuminated the deep affection and companionship that ${petName} would bring to your life.\n\n`;
          break;
        case 'Mars':
          reading += `<b>Mars</b>, the red planet, endowed ${petName} with energy, playfulness, and an adventurous spirit.\n\n`;
          break;
        case 'Saturn':
          reading += `<b>Saturn</b>, the teacher, blessed your relationship with ${petName} with patience, wisdom, and lasting bonds.\n\n`;
          break;
        case 'Mercury':
          reading += `<b>Mercury</b>, the swift messenger, gifted ${petName} with intelligence and the ability to communicate their love for you.\n\n`;
          break;
      }
    });
  }

  // Enhanced Moon phase interpretation
  if (skyData.moon) {
    const moonPhaseInfo = getMoonPhaseInfo(skyData.moon.phase);
    
    if (skyData.moon.visible) {
      reading += `The <b>${moonPhaseInfo.phaseName}</b> illuminated ${petName}'s arrival, representing ${moonPhaseInfo.phaseDescription}.\n\n`;
    } else {
      reading += `Though the <b>${moonPhaseInfo.phaseName}</b> was not visible that night, its hidden influence represented ${moonPhaseInfo.phaseDescription}.\n\n`;
    }
    
  }

  reading += `This unique celestial arrangement will never occur again in exactly the same way, making ${petName}'s star map a truly one-of-a-kind cosmic fingerprint of your special bond.`;

  return reading;
}

// Function to draw moon with correct phase visualization
function drawMoonPhase(ctx, x, y, phase, radius = 8) {
  // Calculate phase position (0 = new moon, 0.5 = full moon, 1 = new moon again)
  const phaseNormalized = phase % 1; // Ensure it's between 0 and 1
  
  ctx.save();
  
  if (phaseNormalized < 0.0625 || phaseNormalized > 0.9375) {
    // New Moon - very dark circle with subtle outline
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    return; // New moon is barely visible
  }
  
  // Base moon circle
  ctx.fillStyle = '#e6e6e6';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Shadow overlay based on phase
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  
  if (phaseNormalized <= 0.5) {
    // Waxing phases (0 to 0.5)
    const shadowWidth = radius * 2 * (0.5 - phaseNormalized) / 0.5;
    ctx.ellipse(x, y, shadowWidth, radius, 0, 1.5 * Math.PI, 0.5 * Math.PI);
  } else {
    // Waning phases (0.5 to 1)
    const shadowWidth = radius * 2 * (phaseNormalized - 0.5) / 0.5;
    ctx.ellipse(x, y, shadowWidth, radius, 0, 0.5 * Math.PI, 1.5 * Math.PI);
  }
  
  ctx.fill();
  ctx.restore();
}

// Function to check if position overlaps with existing objects
function checkOverlap(x, y, width, height, existingObjects, minDistance = 50) {
  for (let obj of existingObjects) {
    const distance = Math.sqrt((x - obj.x) ** 2 + (y - obj.y) ** 2);
    if (distance < minDistance) {
      return true;
    }
  }
  
  // Check boundaries
  if (x < 20 || x > width - 100 || y < 40 || y > height - 40) {
    return true;
  }
  
  return false;
}

// Function to find non-overlapping position
function findNonOverlappingPosition(baseX, baseY, width, height, existingObjects, maxAttempts = 50) {
  // Try the original position first
  if (!checkOverlap(baseX, baseY, width, height, existingObjects)) {
    return { x: baseX, y: baseY };
  }
  
  // Try positions in expanding circles around the base position
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const radius = 30 + (attempt * 15); // Start with 30px radius, expand by 15px each attempt
    const angleStep = Math.PI / 6; // 30 degree steps
    
    for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
      const newX = baseX + radius * Math.cos(angle);
      const newY = baseY + radius * Math.sin(angle);
      
      if (!checkOverlap(newX, newY, width, height, existingObjects)) {
        return { x: newX, y: newY };
      }
    }
  }
  
  // If all else fails, use a fallback position
  const fallbackX = Math.random() * (width - 200) + 100;
  const fallbackY = Math.random() * (height - 200) + 100;
  return { x: fallbackX, y: fallbackY };
}

async function generateCosmicReadingImage(reading, petName, skyData) {
  const width = 800;
  const height = 1400; // Made taller for additional content
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Subtle space gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');  // Deep purple
  gradient.addColorStop(0.3, '#16213e'); // Navy blue
  gradient.addColorStop(0.7, '#0f3460'); // Darker blue
  gradient.addColorStop(1, '#0a1930');   // Very dark blue
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add random twinkling stars (keeping these for background ambiance)
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
  // Load star image
  const starImage = await loadImage('./public/star.png');

  // Measure the title text to position stars properly
  const titleText = `${petName}'s Cosmic Reading`;
  const titleWidth = ctx.measureText(titleText).width;
  const starSize = 28; // Match text height

  // Draw left star (at edge of text)
  ctx.drawImage(starImage, width / 2 - titleWidth / 2 - starSize - 10, 60 - starSize + 5, starSize, starSize);
  // Draw title text
  ctx.fillText(titleText, width / 2, 60);
  // Draw right star (at edge of text)
  ctx.drawImage(starImage, width / 2 + titleWidth / 2 + 10, 60 - starSize + 5, starSize, starSize);

  // Decorative line
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 150, 80);
  ctx.lineTo(width / 2 + 150, 80);
  ctx.stroke();

  // Process and wrap text
  const lines = reading.split('\n').filter(line => line.trim() !== '');
  let y = 120;
  const lineHeight = 24;
  const maxWidth = width - 80; // 40px margin on each side

  lines.forEach(line => {
    // Handle HTML tags for styling
    let textColor = '#E6E6FA'; // Light lavender
    let font = '16px Georgia, serif';
    let cleanLine = line;

    // Check for moon line FIRST
    let isMoonLine = line.includes('Moon') && (line.includes('illuminated') || line.includes('represented') || line.includes('hidden influence'));

    // Clean and style tags
    if (line.includes('<b>') && line.includes('</b>')) {
      font = 'bold 18px Georgia, serif';
      cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
    }

    if (line.includes('<i>') && line.includes('</i>')) {
      font = 'italic 15px Georgia, serif';
      cleanLine = line.replace(/<i>/g, '').replace(/<\/i>/g, '');
    }

    // Set color - moon line takes priority over bold
    if (isMoonLine) {
      textColor = '#8B6914'; // Even darker brownish color for moon text
    } else if (line.includes('<b>')) {
      // Check if this is a moon phase line (bold moon phase names)
      if (line.includes('Moon') || line.includes('Crescent') || line.includes('Quarter') || line.includes('Gibbous') || line.includes('Full')) {
        textColor = '#8B6914'; // Even darker brownish color for moon text
      } else {
        textColor = '#FFD700'; // Gold for star/planet names
      }
    } else if (line.includes('<i>')) {
      textColor = '#87CEEB'; // Sky blue for any future italic text
    } else {
      textColor = '#E6E6FA'; // Default lavender
    }

    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';

    // Word wrap
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
    
    y += lineHeight + 8; // Extra space between paragraphs
  });

  // Bottom decorative element
  ctx.fillStyle = '#FFD700';
  ctx.font = '20px Georgia, serif';
  ctx.textAlign = 'center';
  // Draw stars around bottom text
  // Measure the bottom text to position stars properly
  const bottomText = 'A Bond Written in the Stars';
  const bottomTextWidth = ctx.measureText(bottomText).width;
  const bottomStarSize = 20; // Match text height

  // Draw stars around bottom text
  ctx.drawImage(starImage, width / 2 - bottomTextWidth / 2 - bottomStarSize - 10, height - 30 - bottomStarSize + 5, bottomStarSize, bottomStarSize);
  ctx.fillText(bottomText, width / 2, height - 30);
  ctx.drawImage(starImage, width / 2 + bottomTextWidth / 2 + 10, height - 30 - bottomStarSize + 5, bottomStarSize, bottomStarSize);

  return canvas.toBuffer('image/png');
}

async function generateStarMap(skyData, petName, adoptionDate, customMessage) {
  const width = 800;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Night sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0a0a23');  // Deep navy
  gradient.addColorStop(1, '#000010');  // Almost black
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add random background stars
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
    ctx.fill();
  }

  // Track existing objects to prevent overlap
  const existingObjects = [];

  // Draw real stars from skyData (only visible ones)
  skyData.stars.forEach(star => {
    const radius = (90 - star.altitude) / 90 * (width / 2 - 50);
    const angle = (star.azimuth - 90) * Math.PI / 180;
    const baseX = width / 2 + radius * Math.cos(angle);
    const baseY = height / 2 + radius * Math.sin(angle);

    // Find non-overlapping position
    const position = findNonOverlappingPosition(baseX, baseY, width, height, existingObjects);
    
    // Draw star
    const size = 2.5;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size, 0, 2 * Math.PI);
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'white';
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw star label
    ctx.fillStyle = '#ffd700';
    ctx.font = '12px serif';
    ctx.textAlign = 'left';
    ctx.fillText(star.name, position.x + 8, position.y - 8);

    // Add to existing objects
    existingObjects.push({ x: position.x, y: position.y, type: 'star', name: star.name });
  });

  // Draw visible planets
  skyData.planets.forEach(planet => {
    const radius = (90 - planet.altitude) / 90 * (width / 2 - 50);
    const angle = (planet.azimuth - 90) * Math.PI / 180;
    const baseX = width / 2 + radius * Math.cos(angle);
    const baseY = height / 2 + radius * Math.sin(angle);

    // Find non-overlapping position
    const position = findNonOverlappingPosition(baseX, baseY, width, height, existingObjects);

    // Draw planet
    ctx.beginPath();
    ctx.arc(position.x, position.y, 4, 0, 2 * Math.PI);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffa500';
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw planet label
    ctx.font = '12px serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'left';
    ctx.fillText(planet.name, position.x + 8, position.y - 8);

    // Add to existing objects
    existingObjects.push({ x: position.x, y: position.y, type: 'planet', name: planet.name });
  });

  // Draw moon (whether visible or not, since it always exists)
  if (skyData.moon) {
    // Calculate moon position
    const radius = (90 - Math.abs(skyData.moon.altitude)) / 90 * (width / 2 - 50);
    const angle = (skyData.moon.azimuth - 90) * Math.PI / 180;
    const baseX = width / 2 + radius * Math.cos(angle);
    const baseY = height / 2 + radius * Math.sin(angle);

    // Find non-overlapping position
    const position = findNonOverlappingPosition(baseX, baseY, width, height, existingObjects);
    
    if (skyData.moon.visible) {
      // Visible moon - full styling
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
      // Hidden moon - subtle indication
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

    // Add to existing objects
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

  // Top-left adoption label with proper date formatting and line wrapping
  const formattedDate = formatDateWithOrdinal(adoptionDate);
  
  // Define text positioning variables FIRST
  const textStartX = 20;
  const textY = 30;
  const pawSize = 20;
  
  // Load and draw paw image
  const paw = await loadImage('./public/paw.png');
  ctx.drawImage(paw, textStartX, textY - pawSize + 5, pawSize, pawSize);
  
  const firstLine = `${petName}, Adopted Under the Stars`;
  const secondLine = `${formattedDate}`;

  ctx.font = 'italic bold 16px Georgia, serif'; // Reduced from 18px to 16px
  ctx.fillStyle = '#FFD700'; // Gold
  ctx.textAlign = 'left';

  // Check if first line would overlap with the "N" (around x=400, y=30)
  const firstLineWidth = ctx.measureText(firstLine).width;
  const northX = width / 2; // 400px
  const northY = 30;

  // Both lines start at same x position for alignment
  ctx.fillText(firstLine, textStartX + 25, textY); // Offset to account for paw image
  ctx.fillText(secondLine, textStartX + 25, textY + 20); // Same x offset, reduced line height

  // Optional: Check if first line still overlaps and handle if needed
  if (textStartX + firstLineWidth > northX - 30) {
    // You might want to use a smaller font or truncate the pet name if it's too long
    console.warn('Pet name might be overlapping with compass direction');
  }

  return canvas.toBuffer('image/png');
}

app.post('/api/dev-generate', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userData = tempUserData[sessionId];
     if (!userData) return res.status(400).json({ error: 'Session not found.' });

     const { petName, ownerEmail, adoptionDate, location } = userData;


    if (!location || typeof location !== 'string' || location.trim() === '') {
      return res.status(400).json({ error: 'Location is required and must be a non-empty string.' });
    }

    console.log("📍 Geocoding location:", location);

    const coordinates = await getCoordinates(location);
    const dateObj = new Date(adoptionDate);
    const skyData = calculateStarPositions(dateObj, coordinates.latitude, coordinates.longitude);
    
    // Generate cosmic reading first to ensure consistency
    const reading = generateCosmicReading(skyData, petName, adoptionDate);
    
    // Generate both images, passing skyData to cosmic reading image for star display
    const starMapImage = await generateStarMap(skyData, petName, adoptionDate);
    const readingImage = await generateCosmicReadingImage(reading, petName, skyData);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: ownerEmail,
      subject: `${petName}'s Star Map is Here!`,
      html: `
        <div style="text-align: center; font-family: Georgia, serif; background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px; color: #E6E6FA;">
          <h2 style="color: #FFD700; margin-bottom: 20px;">🌟 Your Personalized Star Map Has Arrived! 🌟</h2>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            ${petName}'s cosmic reading and star map are attached below. Each image tells the unique story of the celestial alignment on the night ${petName} joined your family.
          </p>
          <p style="font-style: italic; color: #87CEEB;">
            "The stars aligned perfectly for your special bond" ✨
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `${petName}_cosmic_reading.png`,
          content: readingImage,
          cid: 'cosmic_reading'
        },
        {
          filename: `${petName}_star_map.png`,
          content: starMapImage,
          cid: 'star_map'
        }
      ]
    });

    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

const tempUserData = {}; // store temporarily using session ID

app.post('/create-checkout-session', async (req, res) => {
  const { petName, ownerEmail, adoptionDate, location } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price: 'price_1SCtT8C19kpWbGYzeyM8yUNY',  
        quantity: 1
      }],

      success_url: 'https://starpaws.onrender.com/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://starpaws.onrender.com/index.html',
      metadata: { petName, ownerEmail, adoptionDate, location }
    });


    // Save user info temporarily using session ID as key
    tempUserData[session.id] = { petName, ownerEmail, adoptionDate, location };

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log('StarPaws API server running on port 3001');
}); 
