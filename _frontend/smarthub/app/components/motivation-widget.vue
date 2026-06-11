<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../composables/use-settings'

const quotes = [
  { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou" },
  { text: "There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.", author: "Ernest Hemingway" },
  { text: "Stay afraid, but do it anyway. What’s important is the action. You don’t have to wait to be confident. Just do it and eventually the confidence will follow.", author: "Carrie Fisher" },
  { text: "One can choose to go back toward safety or forward toward growth. Growth must be chosen again and again; fear must be overcome again and again.", author: "Abraham Maslow" },
  { text: "We can’t become what we need to be by remaining what we are.", author: "Oprah Winfrey" },
  { text: "If there is no struggle, there is no progress.", author: "Frederick Douglass" },
  { text: "Though no one can go back and make a brand new start, anyone can start from now and make a brand new ending.", author: "Carl Bard" },
  { text: "Incredible change happens in your life when you decide to take control of what you have power over instead of craving control over what you don’t.", author: "Steve Maraboli" },
  { text: "People who are crazy enough to think they can change the world are the ones who do.", author: "Rob Siltanen" },
  { text: "Change is the law of life and those who look only to the past or present are certain to miss the future.", author: "John F. Kennedy" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { text: "A well-educated mind will always have more questions than answers.", author: "Helen Keller" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "One child, one teacher, one book, one pen can change the world.", author: "Malala Yousafzai" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "Always work hard and have fun in what you do because I think that's when you're more successful. You have to choose to do it.", author: "Simone Biles" },
  { text: "Failure is not the opposite of success; it is a stepping stone towards it.", author: "Sundar Pichai" },
  { text: "Twenty years from now you will be more disappointed by the things that you didn’t do than by the ones you did do. So throw off the bowlines. Sail away from the safe harbor. Catch the trade winds in your sails. Explore. Dream. Discover.", author: "Mark Twain" },
  { text: "You can waste your lives drawing lines. Or you can live your life crossing them.", author: "Shonda Rhimes" },
  { text: "It is never too late to be who you might have been.", author: "George Eliot" },
  { text: "The way I see it, if you want the rainbow, you gotta put up with the rain.", author: "Dolly Parton" },
  { text: "Why are you still looking here? Don't you have something better to do?", author: "The Developer" }
]

const currentQuoteIndex = ref(0)
const currentQuote = computed(() => quotes[currentQuoteIndex.value])

let quoteTimer: any = null

onMounted(() => {
  quoteTimer = setInterval(() => {
    currentQuoteIndex.value = (currentQuoteIndex.value + 1) % quotes.length
  }, 15000)
})

onUnmounted(() => {
  if (quoteTimer) clearInterval(quoteTimer)
})

const { resolvedTheme } = useSettings()

const isLightMode = computed(() => {
  return resolvedTheme.value === 'light'
})

const bgStyle = computed(() => {
  if (isLightMode.value) {
    return 'background-image: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.4)), url("/sunny_bg.png");'
  } else {
    return 'background-image: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.55)), url("/nature_bg.png");'
  }
})
</script>

<template>
  <div class="motivation-widget" :style="bgStyle">
    <div class="motivation-widget__overlay"></div>
    <div class="motivation-widget__content">
      <div class="motivation-widget__icon-container">
        <i class="fa-solid fa-compass motivation-widget__icon"></i>
      </div>
      
      <transition name="quote-fade" mode="out-in">
        <div :key="currentQuoteIndex" class="motivation-widget__quote-card">
          <p class="motivation-widget__quote-text">"{{ currentQuote.text }}"</p>
          <p class="motivation-widget__quote-author">— {{ currentQuote.author }}</p>
        </div>
      </transition>
      
      <div class="motivation-widget__footer">
        <i class="fa-solid fa-gear"></i>
        <span>No active routine. Configure your routine in settings.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.motivation-widget {
  position: relative;
  background-size: cover;
  background-position: center;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 32px;
  text-align: center;
  height: 100%;
  min-height: 380px;
  box-sizing: border-box;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  transition: all 0.5s ease;
  animation: bg-subtle-zoom 40s ease-in-out infinite alternate;
}

.motivation-widget__overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.6) 100%);
  z-index: 1;
}

.motivation-widget__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  width: 100%;
  max-width: 90%;
  gap: 28px;
  z-index: 10;
}

.motivation-widget__icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
}

.motivation-widget__icon {
  font-size: 3.5rem;
  color: rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
  animation: spin-slow 35s linear infinite;
}

.motivation-widget__quote-card {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
}

.motivation-widget__quote-text {
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1.6;
  color: #ffffff;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.motivation-widget__quote-author {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.motivation-widget__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.35);
  padding: 8px 16px;
  border-radius: 30px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  margin-bottom: 5px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.motivation-widget__footer:hover {
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.5);
  transform: translateY(-1px);
}

@keyframes spin-slow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes bg-subtle-zoom {
  0% { background-size: 100%; }
  100% { background-size: 110%; }
}

/* Quote Fade Transition */
.quote-fade-enter-active,
.quote-fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.quote-fade-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}

.quote-fade-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-6px);
}
</style>
