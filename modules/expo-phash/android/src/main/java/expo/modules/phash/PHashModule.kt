package expo.modules.phash

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.InputStream
import kotlin.math.*

class PHashModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PHash")

    AsyncFunction("calculatePHash") { imageUri: String, promise: Promise ->
      try {
        val hash = calculatePerceptualHash(imageUri)
        promise.resolve(hash)
      } catch (e: Exception) {
        promise.reject("PHASH_ERROR", "Failed to calculate pHash: ${e.message}", e)
      }
    }

    AsyncFunction("calculateHammingDistance") { hash1: String, hash2: String, promise: Promise ->
      try {
        val distance = hammingDistance(hash1, hash2)
        promise.resolve(distance)
      } catch (e: Exception) {
        promise.reject("HAMMING_ERROR", "Failed to calculate Hamming distance: ${e.message}", e)
      }
    }
  }

  private fun calculatePerceptualHash(imageUri: String): String {
    val context = appContext.reactContext ?: throw Exception("React context not available")
    
    // Load and decode the image
    val inputStream: InputStream = when {
      imageUri.startsWith("content://") -> {
        context.contentResolver.openInputStream(Uri.parse(imageUri))
          ?: throw Exception("Could not open content URI")
      }
      imageUri.startsWith("file://") -> {
        val file = java.io.File(Uri.parse(imageUri).path!!)
        file.inputStream()
      }
      else -> {
        val file = java.io.File(imageUri)
        file.inputStream()
      }
    }

    val originalBitmap = BitmapFactory.decodeStream(inputStream)
      ?: throw Exception("Could not decode image")
    
    inputStream.close()

    // Resize to 32x32 for DCT processing
    val resizedBitmap = Bitmap.createScaledBitmap(originalBitmap, 32, 32, true)
    
    // Convert to grayscale
    val grayscalePixels = convertToGrayscale(resizedBitmap)
    
    // Apply DCT
    val dctCoefficients = applyDCT(grayscalePixels, 32)
    
    // Generate hash
    val hash = generateHashFromDCT(dctCoefficients)
    
    // Clean up
    if (resizedBitmap != originalBitmap) {
      resizedBitmap.recycle()
    }
    originalBitmap.recycle()
    
    return hash
  }

  private fun convertToGrayscale(bitmap: Bitmap): DoubleArray {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    
    val grayscale = DoubleArray(width * height)
    
    for (i in pixels.indices) {
      val pixel = pixels[i]
      val r = (pixel shr 16) and 0xFF
      val g = (pixel shr 8) and 0xFF
      val b = pixel and 0xFF
      
      // Use luminance formula for grayscale conversion
      grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
    }
    
    return grayscale
  }

  private fun applyDCT(pixels: DoubleArray, size: Int): Array<DoubleArray> {
    val dct = Array(size) { DoubleArray(size) }
    
    for (u in 0 until size) {
      for (v in 0 until size) {
        var sum = 0.0
        
        for (x in 0 until size) {
          for (y in 0 until size) {
            val pixelValue = pixels[x * size + y]
            val cosU = cos((2 * x + 1) * u * PI / (2 * size))
            val cosV = cos((2 * y + 1) * v * PI / (2 * size))
            sum += pixelValue * cosU * cosV
          }
        }
        
        // Apply normalization factors
        val alphaU = if (u == 0) 1.0 / sqrt(2.0) else 1.0
        val alphaV = if (v == 0) 1.0 / sqrt(2.0) else 1.0
        
        dct[u][v] = (2.0 / size) * alphaU * alphaV * sum
      }
    }
    
    return dct
  }

  private fun generateHashFromDCT(dctCoefficients: Array<DoubleArray>): String {
    // Use top-left 8x8 DCT coefficients (excluding DC component at [0,0])
    val hashSize = 8
    val coefficients = mutableListOf<Double>()
    
    for (i in 0 until hashSize) {
      for (j in 0 until hashSize) {
        if (i == 0 && j == 0) continue // Skip DC component
        coefficients.add(dctCoefficients[i][j])
      }
    }
    
    // Calculate median of coefficients
    val sortedCoefficients = coefficients.sorted()
    val median = sortedCoefficients[sortedCoefficients.size / 2]
    
    // Generate binary hash based on median comparison
    val binaryHash = StringBuilder()
    for (coeff in coefficients) {
      binaryHash.append(if (coeff > median) '1' else '0')
    }
    
    // Convert binary to hexadecimal
    val hexHash = StringBuilder()
    var i = 0
    while (i < binaryHash.length) {
      val binaryChunk = binaryHash.substring(i, minOf(i + 4, binaryHash.length))
      val paddedChunk = binaryChunk.padEnd(4, '0')
      hexHash.append(paddedChunk.toInt(2).toString(16))
      i += 4
    }
    
    return hexHash.toString().uppercase()
  }

  private fun hammingDistance(hash1: String, hash2: String): Int {
    if (hash1.length != hash2.length) {
      throw Exception("Hash lengths must be equal")
    }
    
    var distance = 0
    
    for (i in hash1.indices) {
      val int1 = hash1[i].toString().toInt(16)
      val int2 = hash2[i].toString().toInt(16)
      
      // XOR and count set bits
      var xor = int1 xor int2
      while (xor != 0) {
        distance += xor and 1
        xor = xor shr 1
      }
    }
    
    return distance
  }
}