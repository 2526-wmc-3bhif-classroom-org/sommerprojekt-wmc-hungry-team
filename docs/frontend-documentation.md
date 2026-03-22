# Frontend documentation  

Our one and only Arthur Dirnberger decided that it would be a funny idea, to start making the frontend with ChatGPT or something genius like that and proceeded to not put a single word of documentation anywhere, making me (Mátyás Darabos) the unfortunate soul to have to decipher the whole thing.

## Technology usage

The frontend right now only consists of ***Nuxt***.  
### Nuxt  
Nuxt is an open-source framework built on Vue.  
It makes connecting the frontend and the backend easier apparently.  

Nuxt documentation can be found under this link: https://nuxt.com/docs/4.x/getting-started/introduction  

## /app Structure

### app.vue (entrypoint)

app.vue does fuck all.  
It is basically just a wrapper for the app, declaring that the stuff are located in the **/pages** folder.  
The actual thing that gets loaded up at the start is the **index.vue**.  
Every *.vue* file under **/pages** corresponds to an actual page that can be found under **/[file name without the .vue]**.  

There are some other stuff that can also be done in the **/pages** folder, but they aren't that important.

The documentation for this is horrible to read, so I'd recommend just asking an AI how it works, but if you are a fan of pain and agony then check out the documentation under: https://nuxt.com/docs/4.x/getting-started/views  