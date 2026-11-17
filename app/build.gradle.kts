plugins {
    id("com.android.application")
}

android {
    namespace = "com.alshami.coverstudio"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.alshami.coverstudio"
        minSdk = 26
        targetSdk = 34
        versionCode = 5
        versionName = "2.2"
        // المستودع الذي تُجلب منه التحديثات الصامتة (يُملأ تلقائياً في GitHub Actions)
        buildConfigField("String", "UPDATE_REPO", "\"${System.getenv("GITHUB_REPOSITORY") ?: "maktabati70-cmd/CoverStudio"}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            // يُفضَّل وضع كلمة السر في أسرار المستودع (KEYSTORE_PASSWORD) بدل الملف
            val pass = System.getenv("KEYSTORE_PASSWORD")?.takeIf { it.isNotBlank() } ?: "coverstudio2026"
            storePassword = pass
            keyAlias = "coverstudio"
            keyPassword = pass
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
