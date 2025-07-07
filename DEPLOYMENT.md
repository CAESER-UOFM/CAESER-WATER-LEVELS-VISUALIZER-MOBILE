# Deployment Guide - Water Level Visualizer

## 🚀 Deploying to Netlify

This guide walks you through deploying the Water Level Visualizer mobile app to your Netlify account.

## Prerequisites

Before deploying, ensure you have:
- A [Netlify](https://netlify.com) account
- Node.js 18+ installed locally
- Netlify CLI installed: `npm install -g netlify-cli`

## Quick Deploy with Netlify CLI (Recommended)

### Step 1: Login to Netlify
```bash
netlify login
```
This will open your browser to authenticate with your Netlify account.

### Step 2: Navigate to the Project
```bash
cd tools/MobileVisualizer
```

### Step 3: Initialize the Site
```bash
netlify init
```
Follow the prompts to create a new site or link to an existing one.

### Step 4: Deploy
```bash
netlify deploy --build --prod
```

Your app will be deployed and you'll get a live URL! 🎉

## Alternative: Git Integration

1. **Push to Git Repository**
   ```bash
   # If not already done, initialize git and push to your repository
   cd tools/MobileVisualizer
   git add .
   git commit -m "Add water level visualizer mobile app"
   git push origin main
   ```

2. **Connect to Netlify**
   - Log into your [Netlify dashboard](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose your Git provider (GitHub/GitLab/Bitbucket)
   - Select your repository containing the water level monitoring code
   - Set the base directory to: `tools/MobileVisualizer`

3. **Configure Build Settings**
   ```
   Base directory: tools/MobileVisualizer
   Build command: npm run build
   Publish directory: tools/MobileVisualizer/.next
   ```

4. **Deploy**
   - Click "Deploy site"
   - Netlify will automatically build and deploy your app
   - You'll get a random URL like `https://amazing-name-123456.netlify.app`

### Option 2: Manual Upload

If you prefer to build locally and upload:

1. **Build the App**
   ```bash
   cd tools/Visualizer
   npm install
   npm run deploy
   ```

2. **Upload to Netlify**
   - In Netlify dashboard, drag and drop the `out` folder to deploy
   - Or use Netlify CLI: `netlify deploy --prod --dir=out`

## 📱 Mobile Optimization Features

The app includes several mobile optimizations:

### **Touch Interface**
- 44px minimum touch targets
- Touch-friendly dropdowns and menus
- Gesture-based chart interactions (pan, zoom, tap)
- Optimized button spacing and sizing

### **Responsive Design**
- Mobile-first CSS with Tailwind breakpoints
- Adaptive layouts for phone/tablet/desktop
- Collapsible navigation and controls
- Touch-optimized data tables

### **Performance**
- Lazy loading of chart components
- Data downsampling for large datasets
- Efficient caching strategies
- Optimized bundle sizes

### **Offline Capability**
- Local database storage using IndexedDB/localStorage
- Service worker for caching (ready for PWA upgrade)
- Offline-first data access

## 🔧 Configuration Options

### Environment Variables (Optional)

You can set these in Netlify's environment variables section:

```env
# App Configuration
NEXT_PUBLIC_APP_NAME="Water Level Visualizer"
NEXT_PUBLIC_MAX_FILE_SIZE="104857600"  # 100MB

# Analytics (optional)
NEXT_PUBLIC_GA_ID="your-google-analytics-id"

# Custom Branding (optional)
NEXT_PUBLIC_ORGANIZATION_NAME="Your Organization"
NEXT_PUBLIC_SUPPORT_EMAIL="support@yourorg.com"
```

### Custom Domain (Optional)

1. In Netlify dashboard, go to "Site settings" → "Domain management"
2. Click "Add custom domain"
3. Follow instructions to configure DNS
4. Netlify will automatically provision SSL certificate

## 📊 Post-Deployment

### Testing Your Deployment

1. **Basic Functionality**
   - Upload a test database file
   - Browse wells and view data
   - Test chart interactions on mobile device
   - Try export functionality

2. **Mobile Testing**
   - Test on actual mobile devices
   - Check touch interactions work properly
   - Verify responsive design at different screen sizes
   - Test file upload on mobile browsers

3. **Performance Testing**
   - Use browser dev tools to check loading times
   - Test with large database files
   - Verify memory usage stays reasonable

### Monitoring

- Monitor site analytics in Netlify dashboard
- Check error logs in "Functions" → "Function logs"
- Use browser console to debug any client-side issues

## 🔒 Security Considerations

The app includes several security headers (configured in `netlify.toml`):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`  
- `Referrer-Policy: strict-origin-when-cross-origin`

All processing happens client-side - no data is sent to servers.

## 🐛 Troubleshooting

### Common Issues

**Build Fails**
- Check that Node.js version is 18+
- Verify all dependencies are in package.json
- Check build logs in Netlify dashboard

**App Won't Load**
- Check browser console for JavaScript errors
- Verify sql.js WASM files are loading correctly
- Try clearing browser cache

**File Upload Issues**
- Check file size limits (100MB default)
- Verify file is valid SQLite database
- Test with different browsers

**Charts Not Rendering**
- Check if device supports WebGL
- Try reducing data points in large datasets
- Verify Recharts is loading properly

### Getting Help

1. Check browser console for error messages
2. Review Netlify build logs
3. Test locally with `npm run dev` to isolate issues
4. Check GitHub issues for similar problems

## 🚀 Next Steps

After successful deployment:

1. **Share the URL** with your team
2. **Add to mobile home screens** for app-like experience
3. **Consider PWA features** for offline capabilities
4. **Monitor usage** and gather feedback
5. **Plan updates** based on user needs

---

## Quick Deploy Checklist

- [ ] Repository pushed to Git
- [ ] Netlify account created
- [ ] Repository connected to Netlify
- [ ] Build settings configured
- [ ] Deployment successful
- [ ] Mobile testing completed
- [ ] Custom domain configured (optional)
- [ ] Team access shared

Your Water Level Visualizer is now ready for field use! 📱💧