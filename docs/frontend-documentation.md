# Frontend documentation  

Our one and only Arthur Dirnberger decided that it would be a funny idea, to start making the frontend with ChatGPT or something genius like that and proceeded to not put a single word of documentation anywhere, making me (Mátyás Darabos) the unfortunate soul to have to decipher the whole thing.



## Technology usage

The frontend right now only consists of ***Nuxt***.  
### Nuxt  
Nuxt is an open-source framework built on Vue.  
It makes connecting the frontend and the backend easier apparently.  

Nuxt documentation can be found under this link: https://nuxt.com/docs/4.x/getting-started/introduction  

## /app Structure

The following stuff can all be found in the ***/app*** folder

### app.vue (entrypoint)

app.vue does fuck all.  
It is basically just a wrapper for the app, declaring that the stuff are located in the **/pages** folder.  
The actual thing that gets loaded up at the start is the **index.vue**.  
Every *.vue* file under **/pages** corresponds to an actual page that can be found under **/[file name without the .vue]**.  

There are some other stuff that can also be done in the **/pages** folder, but they aren't that important.

The documentation for this is horrible to read, so I'd recommend just asking an AI how it works, but if you are a fan of pain and agony then check out the documentation under: https://nuxt.com/docs/4.x/getting-started/views  


### /layouts folder
The **/layouts** are responsible for the, you guessed it, layouts.  
It contains all the layouts that are applied for the pages.  

They are made up of the *`<Header />`*, *`<slot />`* and *`<Footer />`* but custom stuff, like the *`<div class="hover-corner" ...`* in the default page, can also be added.  

The pages use the **default.vue** by default.

The following can be used to change the layout: 
```
definePageMeta({
  layout: 'layoutFileNameWithoutTheExtension'
})
```

### /layouts/default.vue  
I'll try to explain the whole file section by section.  

#### template  

##### Header  
The header currently just has the Project name in it and a clock.  
I'm not sure why the clock needs to be there, considering that one of the main widgets on the front page is a clock, but whatever.  

This will be displayed at the top of every Page that has this layout.  

##### Main  
This contains the actual page in it.  
The `<slot />` get's replaced with the actual content of the page.

##### Hover-corner  
The `@mouseenter` event sets the value `gearVisible` to true when the mouse enters a specific region and the `@mouseleave` does the exact opposite.  
I'm not sure how Arthur wants to do this on Phones and his nightstand monitor thingy, but good on him for doing something.  

The `<Transition name="gear">` is responsible for the fade-in and fade-out animation.

Thanks to the `v-if="gearVisible"` the button only appears when the gearVisible is true.  

When clicked it emits `open-settings`.  

#### Script

The script imports `ref`, `onMounted` and `onUnmounted` from ***'vue'***  

The variables `currentTime` and `gearVisible` get declared.  

With `defineEmits(['open-settings'])` the script declares that the component can emit `open-settings`  

The `updateClock` function updates the clock. It get's displayed according to the `de-AT` default.  

Thanks to the `onMounted()` function, the clock get's updated every second until it is cleared by the `unMounted()` function.  

#### Style
The style is pretty self explanatory, so I won't waste any time explaining it.  

#### NOTE  
I have no clue if/where the `open-settings` event get's listened to.  
Considering that clicking the button does nothing, it is most likely not connected to anything.  

If anyone does touch it, make sure to comment it in the file somewhere and also write it into the documentation!

### /components  
They work the same way as they do in the default *Vue* framework, except that *Nuxt* automatically imports them.  