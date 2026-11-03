import AppKit
import Foundation

func drawReminderIcon(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return image
    }

    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let inset = size * 0.06
    let cardRect = rect.insetBy(dx: inset, dy: inset)
    let cornerRadius = size * 0.225

    // 1. Rounded squircle background: vibrant Cobalt-Teal to Deep Midnight gradient (completely distinct from AfterBridge)
    ctx.saveGState()
    let bgPath = CGPath(roundedRect: cardRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
    ctx.addPath(bgPath)
    ctx.clip()

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bgColors = [
        CGColor(red: 0.05, green: 0.52, blue: 0.62, alpha: 1.0), // Vibrant Teal Top
        CGColor(red: 0.07, green: 0.20, blue: 0.42, alpha: 1.0), // Royal Blue Mid
        CGColor(red: 0.54, green: 0.08, blue: 0.22, alpha: 1.0)  // QNA Anabi #8A1538 Base
    ] as CFArray
    let locations: [CGFloat] = [0.0, 0.55, 1.0]
    if let grad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: locations) {
        ctx.drawLinearGradient(
            grad,
            start: CGPoint(x: size * 0.2, y: size * 0.95),
            end: CGPoint(x: size * 0.85, y: size * 0.05),
            options: []
        )
    }
    ctx.restoreGState()

    // Gold border ring around squircle
    ctx.saveGState()
    ctx.addPath(bgPath)
    ctx.setStrokeColor(CGColor(red: 0.96, green: 0.78, blue: 0.26, alpha: 0.9))
    ctx.setLineWidth(size * 0.022)
    ctx.strokePath()
    ctx.restoreGState()

    // 2. Twin Golden Alarm Bells on top-left and top-right
    let center = CGPoint(x: size * 0.5, y: size * 0.48)
    let clockRadius = size * 0.27

    func drawBell(angleDeg: CGFloat) {
        ctx.saveGState()
        let rad = angleDeg * .pi / 180.0
        let bellDist = clockRadius * 1.16
        let bx = center.x + cos(rad) * bellDist
        let by = center.y + sin(rad) * bellDist
        ctx.translateBy(x: bx, y: by)
        ctx.rotate(by: rad - (.pi / 2.0))

        let bellRect = CGRect(x: -size * 0.095, y: -size * 0.035, width: size * 0.19, height: size * 0.11)
        let bellPath = CGPath(roundedRect: bellRect, cornerWidth: size * 0.055, cornerHeight: size * 0.055, transform: nil)
        ctx.addPath(bellPath)
        ctx.setFillColor(CGColor(red: 1.0, green: 0.80, blue: 0.18, alpha: 1.0))
        ctx.fillPath()
        ctx.restoreGState()
    }
    drawBell(angleDeg: 132)
    drawBell(angleDeg: 48)

    // Sound waves radiating from top bells
    for rMult in [1.42, 1.56] {
        ctx.saveGState()
        ctx.setStrokeColor(CGColor(red: 1.0, green: 0.88, blue: 0.40, alpha: 0.85))
        ctx.setLineWidth(size * 0.018)
        ctx.setLineCap(.round)
        ctx.addArc(center: center, radius: clockRadius * CGFloat(rMult), startAngle: 35 * .pi / 180, endAngle: 62 * .pi / 180, clockwise: false)
        ctx.strokePath()
        ctx.addArc(center: center, radius: clockRadius * CGFloat(rMult), startAngle: 118 * .pi / 180, endAngle: 145 * .pi / 180, clockwise: false)
        ctx.strokePath()
        ctx.restoreGState()
    }

    // 3. Crisp White Alarm Clock Face with Gold Rim
    let clockRect = CGRect(
        x: center.x - clockRadius,
        y: center.y - clockRadius,
        width: clockRadius * 2,
        height: clockRadius * 2
    )
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -size * 0.02), blur: size * 0.04, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.45))
    ctx.setFillColor(CGColor(red: 0.99, green: 0.98, blue: 0.96, alpha: 1.0))
    ctx.fillEllipse(in: clockRect)
    ctx.restoreGState()

    ctx.saveGState()
    ctx.setStrokeColor(CGColor(red: 0.95, green: 0.73, blue: 0.15, alpha: 1.0))
    ctx.setLineWidth(size * 0.032)
    ctx.strokeEllipse(in: clockRect)
    ctx.restoreGState()

    // 12 Hour Tick Marks
    for i in 0..<12 {
        let angle = CGFloat(i) * (.pi / 6.0)
        let innerR = clockRadius * (i % 3 == 0 ? 0.74 : 0.81)
        let outerR = clockRadius * 0.89
        ctx.saveGState()
        ctx.setStrokeColor(CGColor(red: 0.15, green: 0.18, blue: 0.26, alpha: 1.0))
        ctx.setLineWidth(i % 3 == 0 ? size * 0.018 : size * 0.01)
        ctx.setLineCap(.round)
        ctx.move(to: CGPoint(x: center.x + cos(angle) * innerR, y: center.y + sin(angle) * innerR))
        ctx.addLine(to: CGPoint(x: center.x + cos(angle) * outerR, y: center.y + sin(angle) * outerR))
        ctx.strokePath()
        ctx.restoreGState()
    }

    // Clock Hands pointing to 11:00 and 3:00 (QNA Maroon #8A1538 & Deep Navy)
    ctx.saveGState()
    ctx.setLineCap(.round)
    // Hour hand (11 o'clock = 120 deg)
    let hourAngle = 120.0 * CGFloat.pi / 180.0
    ctx.setStrokeColor(CGColor(red: 0.541, green: 0.082, blue: 0.220, alpha: 1.0)) // #8A1538
    ctx.setLineWidth(size * 0.032)
    ctx.move(to: center)
    ctx.addLine(to: CGPoint(x: center.x + cos(hourAngle) * clockRadius * 0.52, y: center.y + sin(hourAngle) * clockRadius * 0.52))
    ctx.strokePath()

    // Minute hand (3 o'clock = 0 deg)
    let minAngle = 0.0 * CGFloat.pi / 180.0
    ctx.setStrokeColor(CGColor(red: 0.07, green: 0.20, blue: 0.42, alpha: 1.0))
    ctx.setLineWidth(size * 0.026)
    ctx.move(to: center)
    ctx.addLine(to: CGPoint(x: center.x + cos(minAngle) * clockRadius * 0.68, y: center.y + sin(minAngle) * clockRadius * 0.68))
    ctx.strokePath()

    // Center cap
    ctx.setFillColor(CGColor(red: 0.95, green: 0.73, blue: 0.15, alpha: 1.0))
    ctx.fillEllipse(in: CGRect(x: center.x - size * 0.028, y: center.y - size * 0.028, width: size * 0.056, height: size * 0.056))
    ctx.restoreGState()

    // 4. Emerald Checkmark Badge at Bottom-Right of Clock
    let badgeCenter = CGPoint(x: center.x + clockRadius * 0.72, y: center.y - clockRadius * 0.68)
    let badgeR = size * 0.105
    let badgeRect = CGRect(x: badgeCenter.x - badgeR, y: badgeCenter.y - badgeR, width: badgeR * 2, height: badgeR * 2)
    ctx.saveGState()
    ctx.setFillColor(CGColor(red: 0.06, green: 0.72, blue: 0.50, alpha: 1.0))
    ctx.fillEllipse(in: badgeRect)
    ctx.setStrokeColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.setLineWidth(size * 0.018)
    ctx.strokeEllipse(in: badgeRect)

    // Checkmark inside badge
    ctx.setStrokeColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.setLineWidth(size * 0.024)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.move(to: CGPoint(x: badgeCenter.x - badgeR * 0.42, y: badgeCenter.y - badgeR * 0.02))
    ctx.addLine(to: CGPoint(x: badgeCenter.x - badgeR * 0.10, y: badgeCenter.y - badgeR * 0.36))
    ctx.addLine(to: CGPoint(x: badgeCenter.x + badgeR * 0.46, y: badgeCenter.y + badgeR * 0.34))
    ctx.strokePath()
    ctx.restoreGState()

    image.unlockFocus()
    return image
}

func savePng(_ image: NSImage, to path: String, pixelSize: Int) {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelSize,
        pixelsHigh: pixelSize,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    image.draw(in: NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize))
    NSGraphicsContext.restoreGraphicsState()

    if let pngData = rep.representation(using: .png, properties: [:]) {
        try? pngData.write(to: URL(fileURLWithPath: path))
    }
}

let fm = FileManager.default
let iconsetDir = "/tmp/MyReminderAppIcon.iconset"
try? fm.removeItem(atPath: iconsetDir)
try fm.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

let specs: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

let masterImage = drawReminderIcon(size: 1024)
for (name, px) in specs {
    let img = drawReminderIcon(size: CGFloat(px))
    savePng(img, to: "\(iconsetDir)/\(name)", pixelSize: px)
}

let projectAppPath = "/Users/Hasan/Desktop/Hasan/MyReminder/MyReminder Control.app"
let desktopAppPath = "/Users/Hasan/Desktop/MyReminder Control.app"
let applicationsAppPath = "/Applications/MyReminder Control.app"
let icnsPath = "\(projectAppPath)/Contents/Resources/AppIcon.icns"
let publicIconsDir = "/Users/Hasan/Desktop/Hasan/MyReminder/public/icons"
try? fm.createDirectory(atPath: publicIconsDir, withIntermediateDirectories: true)
savePng(drawReminderIcon(size: 192), to: "\(publicIconsDir)/icon-192.png", pixelSize: 192)
savePng(drawReminderIcon(size: 512), to: "\(publicIconsDir)/icon-512.png", pixelSize: 512)

let proc = Process()
proc.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
proc.arguments = ["-c", "icns", iconsetDir, "-o", icnsPath]
try proc.run()
proc.waitUntilExit()

for targetApp in [desktopAppPath, applicationsAppPath] {
    if fm.fileExists(atPath: targetApp) {
        try? fm.removeItem(atPath: "\(targetApp)/Contents/Resources/AppIcon.icns")
        try? fm.copyItem(atPath: icnsPath, toPath: "\(targetApp)/Contents/Resources/AppIcon.icns")
        NSWorkspace.shared.setIcon(masterImage, forFile: targetApp, options: [])
    }
}

// Force Finder on Desktop to immediately display the new custom icon
NSWorkspace.shared.setIcon(masterImage, forFile: projectAppPath, options: [])
print("[PASS] Generated custom MyReminder AppIcon.icns + PWA icons and applied to Desktop & Applications bundles.")
