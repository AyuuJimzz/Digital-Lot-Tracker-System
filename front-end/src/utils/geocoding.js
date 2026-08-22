// front-end/src/utils/geocoding.js
import axios from "axios";

/**
 * Searches for GPS coordinates [latitude, longitude] for a given location address in the Philippines
 * Uses OpenStreetMap Nominatim API (Free & Open Source)
 * @param {string} address - The address or place name to search (e.g. "Abilay Norte, Oton, Iloilo")
 * @returns {Promise<{lat: number, lng: number, displayName: string} | null>}
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== "string" || !address.trim()) {
    return null;
  }

  try {
    const cleanAddress = address.trim();
    // Append Philippines context if not already present
    const searchQuery = cleanAddress.toLowerCase().includes("philippines")
      ? cleanAddress
      : `${cleanAddress}, Philippines`;

    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        format: "json",
        q: searchQuery,
        limit: 5,
        addressdetails: 1,
      },
      headers: {
        "Accept-Language": "en",
      },
    });

    if (Array.isArray(response.data) && response.data.length > 0) {
      const topResult = response.data[0];
      return {
        lat: parseFloat(topResult.lat),
        lng: parseFloat(topResult.lon),
        displayName: topResult.display_name,
        allResults: response.data.map((r) => ({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
        })),
      };
    }

    return null;
  } catch (error) {
    console.warn("Geocoding lookup notice:", error.message);
    return null;
  }
}
