export const TRUCK_TYPES = {
  Framingham: ['Flatbed', 'Triaxle (22 tons)', '6 Wheeler Dump (10 tons)', 'Roll Off'],
  Marlborough: ['Flatbed', 'Triaxle (22 tons)', '6 Wheeler Dump (10 tons)']
};

export const TRUCK_COLORS = {
  Framingham: {
    'Flatbed': '#ed1c25',           // Red
    'Triaxle (22 tons)': '#ff7f27', // Orange  
    '6 Wheeler Dump (10 tons)': '#fff204', // Yellow
    'Roll Off': '#22b14c'            // Green
  },
  Marlborough: {
    'Flatbed': '#303bcd',           // Dark Blue
    'Triaxle (22 tons)': '#04a1e8', // Light Blue
    '6 Wheeler Dump (10 tons)': '#ffafc9' // Pink
  }
};

// Function to determine if text should be white or black based on background color
export const getContrastTextColor = (backgroundColor: string): string => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

export const getTruckColor = (originStore: string, truckType: string): string => {
  // Handle both originStore and currentStore parameters
  const store = originStore || 'Framingham'; // Default fallback
  return TRUCK_COLORS[store as keyof typeof TRUCK_COLORS]?.[truckType] || '#6B7280';
};

// Enhanced function to determine if background is dark and needs white text
export const isDarkBackground = (backgroundColor: string): boolean => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance using standard formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if background is dark (luminance < 0.5)
  return luminance < 0.5;
};

// Get appropriate text color based on background
export const getTextColorForBackground = (backgroundColor: string): string => {
  return isDarkBackground(backgroundColor) ? '#ffffff' : '#000000';
};