<script setup lang="ts">
definePageMeta({
  layout: 'landing',
  middleware: ['redirect-dashboard']
})
</script>

<template>
  <div class="home">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero__content">
        <h1 class="hero__title">SmartHub</h1>
        <p class="hero__subtitle">
          Your intelligent dashboard for urban mobility, real-time information, and daily routines
        </p>
        <div class="hero__buttons">
          <NuxtLink to="/dashboard" class="btn btn--primary">
            Go to Dashboard →
          </NuxtLink>
          <a href="#features" class="btn btn--secondary">
            Learn More ↓
          </a>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features" id="features">
      <h2 class="section__title">Core Features</h2>
      <div class="features__grid">
        <div class="feature-card">
          <div class="feature-card__icon">🚌</div>
          <h3 class="feature-card__title">Real-Time Transit</h3>
          <p class="feature-card__description">
            Find optimal bus routes with live data integration. Get multi-leg journeys with transfer options.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-card__icon">🌦️</div>
          <h3 class="feature-card__title">Weather Forecast</h3>
          <p class="feature-card__description">
            Hourly weather updates for your location to help plan your day.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-card__icon">⏰</div>
          <h3 class="feature-card__title">Digital Clock</h3>
          <p class="feature-card__description">
            Always-on time display, perfect for wall-mounted displays and quick glances.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-card__icon">📍</div>
          <h3 class="feature-card__title">Smart Routing</h3>
          <p class="feature-card__description">
            Geocoding and route planning for any location. Find the best way to get anywhere.
          </p>
        </div>
      </div>
    </section>

    <!-- About Section -->
    <section class="about">
      <h2 class="section__title">About SmartHub</h2>
      <div class="about__content">
        <p>
          SmartHub is a webapp designed for but not exclusive to a <strong>Raspberry Pi</strong> designed to deliver critical urban information at a glance. Whether mounted on your wall or displayed on a kiosk, SmartHub provides:
        </p>
        <ul class="about__list">
          <li><strong>Live Transit Information</strong> – Real-time bus routes and journey planning for public transport</li>
          <li><strong>Environmental Data</strong> – Current weather and hourly forecasts</li>
          <li><strong>Time Management</strong> – Always-visible clock and routine scheduling</li>
          <li><strong>Responsive Design</strong> – Optimized for any screen size, from 7" to 55" displays</li>
        </ul>
        <p>
          Built with <strong>Nuxt 4 & Vue 3</strong> for the frontend and <strong>Express.js with Neo4j</strong> for intelligent routing, SmartHub bridges the gap between everyday information needs and beautiful, accessible design.
        </p>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section class="use-cases">
      <h2 class="section__title">Perfect For</h2>
      <div class="use-cases__grid">
        <div class="use-case-item">
          <span class="use-case-item__emoji">🏠</span>
          <h3>Smart Homes</h3>
          <p>A central hub for family schedules and transit information in your hallway or kitchen</p>
        </div>
        <div class="use-case-item">
          <span class="use-case-item__emoji">🏢</span>
          <h3>Offices & Workspaces</h3>
          <p>Keep your team informed about weather, transit times, and appointments</p>
        </div>
        <div class="use-case-item">
          <span class="use-case-item__emoji">🚌</span>
          <h3>Transit Stations</h3>
          <p>Display real-time route information and waits times for commuters</p>
        </div>
        
      </div>
    </section>

    <!-- Tech Stack Section -->
    <section class="tech-stack">
      <h2 class="section__title">Built With Modern Tech</h2>
      <div class="tech-grid">
        <div class="tech-item">
          <div class="tech-item__name">Frontend</div>
          <p>Nuxt 4 • Vue 3 • TypeScript • Tailwind</p>
        </div>
        <div class="tech-item">
          <div class="tech-item__name">Backend</div>
          <p>Express.js • Node.js • TypeScript</p>
        </div>
        <div class="tech-item">
          <div class="tech-item__name">Database</div>
          <p>Neo4j Graph Database</p>
        </div>
        <div class="tech-item">
          <div class="tech-item__name">Data Sources</div>
          <p>GTFS Transit Data • OpenMeteo • Google Geocoding</p>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <h2 class="section__title">Ready to Try It?</h2>
      <p class="cta__description">
        Explore the dashboard and see what SmartHub can do for you.
      </p>
      <NuxtLink to="/dashboard" class="btn btn--primary btn--large">
        Open Dashboard →
      </NuxtLink>
    </section>

    <!-- Footer Section -->
    <footer class="footer">
      <p>SmartHub • Smart Living for the Modern Age</p>
      <p class="footer__meta">Made by Arthur Dirnberger, Matyas Darabos, Benjamin Stoica, Almir Hadzic</p>
    </footer>
  </div>
</template>

<style scoped>

/* ── Layout ── */
.home {
  display: flex;
  flex-direction: column;
  gap: 60px;
  padding-top: 40px;
  padding-bottom: 60px;
}

/* ── Hero Section ── */
.hero {
  text-align: center;
  animation: fadeIn 0.6s ease;
}

.hero__content {
  max-width: 600px;
  margin: 0 auto;
}

.hero__title {
  font-size: 3.5rem;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}

.hero__subtitle {
  font-size: 1.25rem;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 40px;
}

.hero__buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ── Button Styles ── */
.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.btn--primary {
  background: #4b3dc9;
  color: white;
}

.btn--primary:hover {
  background: #372d8e;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

.btn--secondary {
  background: transparent;
  color: #3b44f6;
  border: 2px solid #3b44f6;
}

.btn--secondary:hover {
  background: #eff6ff;
  transform: translateY(-2px);
}

.btn--large {
  padding: 16px 32px;
  font-size: 1.1rem;
}

/* ── Section Title ── */
.section__title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
  margin-bottom: 40px;
}

/* ── Features Section ── */
.features {
  animation: fadeIn 0.6s ease 0.1s both;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.feature-card {
  background: white;
  padding: 32px 24px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.feature-card__icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.feature-card__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.feature-card__description {
  color: #424752;
  line-height: 1.6;
  font-size: 0.95rem;
}

/* ── About Section ── */
.about {
  max-width: 700px;
  margin: 0 auto;
  animation: fadeIn 0.6s ease 0.2s both;
}

.about__content {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.about__content p {
  color: #374151;
  line-height: 1.8;
  margin-bottom: 20px;
  font-size: 1rem;
}

.about__list {
  list-style: none;
  padding: 0;
  margin: 20px 0;
  color: #2a3342;
  line-height: 1.8;
}

.about__list li {
  padding: 12px 0;
  padding-left: 28px;
  position: relative;
}

.about__list li:before {
  content: "✓";
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
  font-size: 1.2rem;
}

/* ── Use Cases Section ── */
.use-cases {
  animation: fadeIn 0.6s ease 0.3s both;
}

.use-cases__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.use-case-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 32px 24px;
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s ease;
}

.use-case-item:nth-child(2) {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.use-case-item:nth-child(3) {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.use-case-item:nth-child(4) {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.use-case-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
}

.use-case-item__emoji {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 16px;
}

.use-case-item h3 {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.use-case-item p {
  font-size: 0.9rem;
  opacity: 0.95;
  line-height: 1.5;
}

/* ── Tech Stack Section ── */
.tech-stack {
  animation: fadeIn 0.6s ease 0.4s both;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.tech-item {
  background: #f3f4f6;
  padding: 28px 24px;
  border-radius: 12px;
  border-left: 4px solid #3b82f6;
}

.tech-item__name {
  display: block;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 8px;
  font-size: 1.1rem;
}

.tech-item p {
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.5;
}

/* ── CTA Section ── */
.cta {
  text-align: center;
  animation: fadeIn 0.6s ease 0.5s both;
}

.cta__description {
  font-size: 1.1rem;
  color: #6b7280;
  margin-bottom: 32px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* ── Footer ── */
.footer {
  text-align: center;
  border-top: 1px solid #e5e7eb;
  padding-top: 40px;
  color: #535a67;
  font-size: 0.95rem;
}

.footer__meta {
  font-size: 0.85rem;
  margin-top: 8px;
}

/* ── Animations ── */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .hero__title {
    font-size: 2.5rem;
  }

  .hero__subtitle {
    font-size: 1rem;
  }

  .hero__buttons {
    flex-direction: column;
  }

  .section__title {
    font-size: 2rem;
    margin-bottom: 30px;
  }

  .features__grid {
    grid-template-columns: 1fr;
  }

  .about__content {
    padding: 24px;
  }
}
</style>