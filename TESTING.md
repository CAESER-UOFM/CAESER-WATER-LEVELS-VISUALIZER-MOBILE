# Water Level Visualizer - Testing Guide

## 🧪 Testing the Mobile Web App

This guide provides step-by-step instructions for testing the Water Level Visualizer mobile web app.

## ⚡ Quick Start Testing

### **1. Start the Development Server**
```bash
cd tools/Visualizer
npm run dev
```
The app will be available at `http://localhost:3000`

### **2. Test Build Process**
```bash
npm run build
```
Verify that the build completes successfully without errors.

## 📱 Manual Testing Checklist

### **🏠 Homepage Testing**
- [ ] **Page loads correctly** with title and description
- [ ] **Database upload area** displays with drag-and-drop functionality
- [ ] **Feature cards** show all four main features
- [ ] **Responsive design** works on different screen sizes
- [ ] **Getting started info** displays correctly

### **📁 Database Upload Testing**

#### **Valid File Upload**
- [ ] **Drag and drop** a valid `.db` file works
- [ ] **Click to browse** file selection works
- [ ] **Progress indicator** shows during upload
- [ ] **Success message** appears after successful upload
- [ ] **Database appears** in the database selector

#### **Invalid File Handling**
- [ ] **Wrong file type** (e.g., `.txt`) shows error message
- [ ] **Oversized file** (>100MB) shows size limit error
- [ ] **Corrupted database** shows validation error
- [ ] **Empty file** shows appropriate error

#### **Database Validation**
- [ ] **Schema validation** checks for required tables
- [ ] **Wells count** is calculated and displayed correctly
- [ ] **File size** is formatted properly (KB/MB)
- [ ] **Upload date** shows current timestamp

### **🗂️ Database Selection Testing**
- [ ] **Multiple databases** can be uploaded and stored
- [ ] **Database cards** show metadata (wells count, size, date)
- [ ] **Delete functionality** removes databases
- [ ] **Selection** navigates to wells browser
- [ ] **Local storage** persists databases between sessions

### **🔍 Wells Browser Testing**

#### **Data Loading**
- [ ] **Wells load** from selected database
- [ ] **Loading states** show appropriate spinners
- [ ] **Error handling** displays when database is unavailable
- [ ] **Empty state** shows when no wells found

#### **Search and Filtering**
- [ ] **Search by well number** filters results correctly
- [ ] **Search by CAE number** works
- [ ] **Search by field name** filters properly
- [ ] **Data availability filter** (with/without data) works
- [ ] **Well field dropdown** populates and filters correctly

#### **Table Functionality**
- [ ] **Sorting by well number** works (asc/desc)
- [ ] **Sorting by CAE number** works
- [ ] **Sorting by last reading date** works
- [ ] **Pagination** works with large datasets
- [ ] **Data type badges** show correctly (T, M, Tel)
- [ ] **Row clicking** navigates to plot page

#### **Mobile Optimization**
- [ ] **Touch targets** are large enough (44px minimum)
- [ ] **Horizontal scrolling** works on small screens
- [ ] **Responsive table** adapts to screen size

### **📊 Plot Viewer Testing**

#### **Page Navigation**
- [ ] **URL with well number** loads correct well data
- [ ] **Back button** returns to wells browser
- [ ] **Breadcrumb navigation** works
- [ ] **Header shows** well information correctly

#### **Data Loading**
- [ ] **Water level data** loads and displays
- [ ] **Manual readings** load separately
- [ ] **Temperature data** loads when available
- [ ] **Loading states** show during data fetch
- [ ] **Error states** handle missing wells gracefully

#### **Chart Functionality**
- [ ] **Line chart** renders water level data
- [ ] **Manual readings** show as scatter points
- [ ] **Temperature line** displays when enabled
- [ ] **Tooltips** show detailed information on hover/tap
- [ ] **Legend** displays correctly
- [ ] **Axis labels** show appropriate units

#### **Chart Controls**
- [ ] **Data type toggles** show/hide chart lines
- [ ] **Date range presets** filter data correctly
- [ ] **Custom date range** allows manual selection
- [ ] **Brush navigation** works for large datasets
- [ ] **Zoom and pan** work on mobile devices

#### **Chart Interactions (Mobile)**
- [ ] **Touch and drag** pans the chart
- [ ] **Pinch to zoom** works on mobile
- [ ] **Tap data points** shows tooltips
- [ ] **Double tap** resets zoom level

### **🧮 Recharge Results Testing**

#### **Page Access**
- [ ] **Recharge button** navigates from plot page
- [ ] **URL routing** works for recharge pages
- [ ] **Back navigation** returns to plot

#### **Results Display**
- [ ] **Method summary cards** show RISE, MRC, EMR results
- [ ] **Results table** displays all calculations
- [ ] **Date formatting** is consistent
- [ ] **Value formatting** shows proper units
- [ ] **Empty state** handles wells without calculations

#### **Method Information**
- [ ] **Method descriptions** are informative
- [ ] **Calculation metadata** displays correctly
- [ ] **Export buttons** are present (functionality TBD)

### **📱 Mobile Optimization Testing**

#### **Touch Interface**
- [ ] **All buttons** have adequate touch targets
- [ ] **Scroll behavior** works smoothly
- [ ] **Touch feedback** provides appropriate responses
- [ ] **Gesture navigation** doesn't conflict with browser

#### **Responsive Design**
- [ ] **Phone portrait** (320px+) layouts work
- [ ] **Phone landscape** layouts adapt
- [ ] **Tablet portrait** (768px+) layouts work
- [ ] **Desktop** (1024px+) layouts utilize space well

#### **Performance**
- [ ] **Initial page load** is under 3 seconds
- [ ] **Chart rendering** is smooth
- [ ] **Data loading** shows progress appropriately
- [ ] **Memory usage** doesn't grow excessively

## 🔍 Browser Testing

### **Supported Browsers**
Test on these browsers and versions:

#### **Mobile Browsers**
- [ ] **Safari iOS** (14+)
- [ ] **Chrome Android** (90+)
- [ ] **Samsung Internet** (latest)
- [ ] **Firefox Mobile** (latest)

#### **Desktop Browsers**
- [ ] **Chrome** (90+)
- [ ] **Firefox** (90+)
- [ ] **Safari** (14+)
- [ ] **Edge** (90+)

### **Browser-Specific Testing**
- [ ] **File upload** works in all browsers
- [ ] **LocalStorage** persists data correctly
- [ ] **Chart interactions** work consistently
- [ ] **CSS animations** render smoothly

## 🐛 Common Issues and Solutions

### **Database Upload Issues**
- **File not uploading**: Check file size and format
- **Validation errors**: Ensure database has required tables
- **Browser compatibility**: Try a different browser

### **Chart Display Issues**
- **Chart not rendering**: Check browser console for errors
- **Performance issues**: Reduce data range or enable downsampling
- **Touch interactions not working**: Ensure browser supports touch events

### **Data Loading Issues**
- **Wells not loading**: Check database file integrity
- **Slow performance**: Try with smaller database or date range
- **Missing data**: Verify database contains expected tables

## 📊 Performance Testing

### **Load Testing**
- [ ] **Large databases** (1000+ wells) load efficiently
- [ ] **Large datasets** (10000+ readings) render smoothly
- [ ] **Multiple databases** can be stored without issues
- [ ] **Memory usage** stays reasonable during extended use

### **Network Testing**
- [ ] **Slow connections** (3G) still usable
- [ ] **Offline usage** works with stored databases
- [ ] **Progressive loading** handles poor connectivity

## ✅ Test Results

### **Test Environment**
- **Date**: [Fill in test date]
- **Browser**: [Fill in browser and version]
- **Device**: [Fill in device type and OS]
- **Database**: [Fill in test database details]

### **Pass/Fail Summary**
- **Homepage**: ✅ Pass / ❌ Fail
- **Database Upload**: ✅ Pass / ❌ Fail
- **Wells Browser**: ✅ Pass / ❌ Fail
- **Plot Viewer**: ✅ Pass / ❌ Fail
- **Recharge Results**: ✅ Pass / ❌ Fail
- **Mobile Optimization**: ✅ Pass / ❌ Fail

### **Notes**
[Add any additional testing notes or issues discovered]

---

## 🚀 Automated Testing (Future)

For future development, consider adding:
- **Unit tests** for database operations
- **Component tests** for React components
- **Integration tests** for user workflows
- **Performance tests** for large datasets
- **Accessibility tests** for screen readers

## 📞 Reporting Issues

When reporting issues, include:
1. **Steps to reproduce** the issue
2. **Expected vs actual behavior**
3. **Browser and device information**
4. **Console error messages** (if any)
5. **Database file characteristics** (size, well count, etc.)