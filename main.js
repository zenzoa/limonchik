let canvas, context
let lastKey
let keyDebounce = 0
let lastTimestamp
let lastAnimationFrame
let animationStep = 0

let mapWidth = 100
let mapHeight = 100

let screenWidth = 12
let screenHeight = 12

let tileWidth = 32
let tileHeight = 32

let offsetX
let offsetY

let avatarX
let avatarY
let avatarDirection = 'left'

let greebles
let trees
let rocks
let portals
let critters

let numPrey = 100
let numPredators = 50
let turnsBetweenPredators = 50
let turnsSinceLastPredator

let gameState

let titleImage
let spritesheet
let images = {}

let makeCritter = (type) => {
    let x = null
    let y = null
    while (x == null || y == null) {
        let blocked = false
        x = Math.floor(Math.random() * mapWidth)
        y = Math.floor(Math.random() * mapHeight)
        if (x === avatarX && y === avatarY) blocked = true
        let blockers = critters.concat(trees).concat(rocks).concat(portals)
        blockers.forEach(blocker => {
            if (x === blocker.x && y === blocker.y) {
                blocked = true
            }
        })
        if (blocked) {
            x = null
            y = null
        }
    }

    return {
        type,
        x,
        y,
        turnTimer: 0,
        blockedTurns: 0,
        direction: 'left'
    }
}

let makeTerrain = (type, x, y, variant) => {
    let blocked = false
    if (x === avatarX && y === avatarY) blocked = true
    let blockers = trees.concat(rocks).concat(greebles).concat(portals)
    blockers.forEach(blocker => {
        if (x === blocker.x && y === blocker.y) {
            blocked = true
        }
    })
    if (blocked) return

    if (type === 'greeble') greebles.push({ x, y, variant })
    if (type === 'tree') trees.push({ x, y, variant })
    if (type === 'rock') rocks.push({ x, y, variant })
}

let randomWalk = (amount, rate, callback, x, y) => {
    let count = 0
    x = x || Math.floor(Math.random() * mapWidth)
    y = y || Math.floor(Math.random() * mapHeight)

    while (count < amount) {
        let direction = Math.random() * 4

        if (direction < 1) x++
        else if (direction < 2) x--
        else if (direction < 3) y++
        else if (direction < 4) y--

        if (x < 0) x = 0
        if (x >= mapWidth) x = mapWidth - 1
        if (y < 0) y = 0
        if (y >= mapHeight) y = mapHeight - 1

        if (Math.random() < rate) {
            count++
            callback(x, y)
        }
    }
}

let generateMap = () => {
    let portalX = Math.floor(Math.random() * (mapWidth - 2))
    let portalY = Math.floor(Math.random() * (mapHeight - 2))
    portals = [
        { x: portalX, y: portalY },
        { x: portalX + 1, y: portalY },
        { x: portalX + 2, y: portalY },
        { x: portalX, y: portalY + 1 },
        { x: portalX + 1, y: portalY + 1 },
        { x: portalX + 2, y: portalY + 1 },
        { x: portalX, y: portalY + 2 },
        { x: portalX + 1, y: portalY + 2 },
        { x: portalX + 2, y: portalY + 2 }
    ]
    randomWalk(20, 0.2, (x, y) => makeTerrain('greeble', x, y, 99), portalX + 1, portalY + 1)
    randomWalk(20, 0.2, (x, y) => makeTerrain('greeble', x, y, 99), portalX + 1, portalY + 1)
    randomWalk(20, 0.2, (x, y) => makeTerrain('greeble', x, y, 99), portalX + 1, portalY + 1)

    for (let i = 0; i < 10; i++) {
        let variant = Math.floor(Math.random() * 3)
        let amount = Math.random() * 200 + 20
        let rate = Math.random() * 0.2 + 0.01
        randomWalk(amount, rate, (x, y) => {
            makeTerrain('greeble', x, y, variant)
        })
    }

    for (let i = 0; i < 3; i++) {
        let variant = Math.floor(Math.random() * 3)
        let amount = Math.random() * 200 + 20
        let rate = Math.random() * 0.1 + 0.01
        randomWalk(amount, rate, (x, y) => {
            makeTerrain('tree', x, y, variant)
        })
    }

    let rockFalls = Math.floor(Math.random() * 10) + 1
    for (let i = 0; i < rockFalls; i++) {
        let variant = Math.floor(Math.random() * 3)
        let amount = Math.random() * 20 + 10
        let rate = Math.random() * 0.06 + 0.01
        randomWalk(amount, rate, (x, y) => {
            makeTerrain('rock', x, y, variant)
        })
    }
}

let update = (timestamp) => {
    if (gameState === 'start') {
        if (lastKey) {
            gameState = 'play'
        }
        context.drawImage(titleImage, 0, 0)
        window.requestAnimationFrame(update)
        return
    }
    else if (gameState === 'end') {
        let numPreyInPortal = critters.filter(c => c.type === 'in-portal').length

        if (!lastAnimationFrame) lastAnimationFrame = timestamp
        if (timestamp - lastAnimationFrame > (2000 / numPreyInPortal)) {
            lastAnimationFrame = null
            animationStep++
        }
        
        if (animationStep >= numPreyInPortal) {
            animationStep = numPreyInPortal
            if (lastKey) {
                startGame()
            }
        } else {
            lastKey = null
        }

        // draw background
        context.fillStyle = '#444'
        context.fillRect(0, 0, canvas.width, canvas.height)

        // draw all prey that went into portal
        for (let i = 0; i < animationStep; i++) {
            let cx = tileWidth - 10 + Math.floor(i % 10) * (tileWidth + 2)
            let cy = canvas.height - tileHeight - (tileHeight - 10 + Math.floor(i / 10) * (tileHeight + 2))
            let isFlipped = i % 3 === 0
            images['prey'].draw(cx, cy, isFlipped, true)
        }

        window.requestAnimationFrame(update)
        return
    }

    if (!lastTimestamp) lastTimestamp = timestamp
    let dt = timestamp - lastTimestamp

    if (keyDebounce === 0) {
        let newAvatarX = avatarX
        let newAvatarY = avatarY
        let blocked = false

        // check input
        if (lastKey === 'ArrowLeft' || lastKey === 'a') newAvatarX--
        else if (lastKey === 'ArrowRight' || lastKey === 'd') newAvatarX++
        else if (lastKey === 'ArrowUp' || lastKey === 'w') newAvatarY--
        else if (lastKey === 'ArrowDown' || lastKey === 's') newAvatarY++

        // set direction of avatar
        if (newAvatarX > avatarX) avatarDirection = 'right'
        if (newAvatarX < avatarX) avatarDirection = 'left'

        // check edges
        if (newAvatarX < 0 || newAvatarX >= mapWidth) blocked = true
        if (newAvatarY < 0 || newAvatarY >= mapHeight) blocked = true

        // check collisions
        let blockers = critters.concat(trees)
        blockers.forEach(blocker => {
            if (newAvatarX === blocker.x && newAvatarY === blocker.y) {
                blocked = true
            }
        })

        // move rocks
        rocks.forEach(rock => {
            if (newAvatarX === rock.x && newAvatarY === rock.y) {
                let newRockX = rock.x + (newAvatarX - avatarX)
                let newRockY = rock.y + (newAvatarY - avatarY)
                let rockBlocked = false
                if (newRockX < 0 || newRockX >= mapWidth) rockBlocked = true
                if (newRockY < 0 || newRockY >= mapHeight) rockBlocked = true
                let blockers = critters.concat(trees).concat(rocks).concat(portals)
                blockers.forEach(blocker => {
                    if (newRockX === blocker.x && newRockY === blocker.y) {
                        rockBlocked = true
                    }
                })
                if (!rockBlocked) {
                    rock.x = newRockX
                    rock.y = newRockY
                } else {
                    blocked = true
                }
            }
        })

        // entering a portal ends the game
        portals.forEach(portal => {
            if (newAvatarX === portal.x && newAvatarY === portal.y) {
                endGame()
            }
        })
        
        // move avatar if not blocked
        if (!blocked && (avatarX !== newAvatarX || avatarY !== newAvatarY)) {
            avatarX = newAvatarX
            avatarY = newAvatarY
            takeTurn()
        }

        // update camera offset
        offsetX = avatarX - Math.floor(screenWidth / 2)
        offsetY = avatarY - Math.floor(screenHeight / 2)
        if (offsetX < 0) offsetX = 0
        if (offsetX > mapWidth - screenWidth) offsetX = mapWidth - screenWidth
        if (offsetY < 0) offsetY = 0
        if (offsetY > mapHeight - screenHeight) offsetY = mapHeight - screenHeight

        lastKey = null
        keyDebounce = 200
    }

    keyDebounce = Math.max(0, keyDebounce - dt)
    lastTimestamp = timestamp

    // draw background
    context.fillStyle = '#DAD1AB'
    context.fillRect(0, 0, canvas.width, canvas.height)

    // draw terrain
    greebles.forEach(greeble => {
        let greebleVariant = greeble.variant === 99 ? 'greeble-portal' : 'greeble'
        images[greebleVariant].draw(greeble.x - offsetX, greeble.y - offsetY)
    })
    trees.forEach(tree => {
        images['tree'].draw(tree.x - offsetX, tree.y - offsetY)
    })
    rocks.forEach(rock => {
        images['rock'].draw(rock.x - offsetX, rock.y - offsetY)
    })

    // draw portal
    portals.forEach((portal, i) => {
        images['portal-' + i].draw(portal.x - offsetX, portal.y - offsetY)
    })

    // draw avatar
    images['avatar'].draw(avatarX - offsetX, avatarY - offsetY, avatarDirection === 'right')

    // draw critters
    critters.forEach(critter => {
        let cx = critter.x - offsetX
        let cy = critter.y - offsetY
        if (cx >= 0 && cx < screenWidth && cy >= 0 && cy < screenHeight) {
            if (critter.type === 'prey') {
                images['prey'].draw(cx, cy, critter.direction === 'right')
            }
            else if (critter.type === 'dead') {
                images['prey-dead'].draw(cx, cy, critter.direction === 'right')
            }
            else if (critter.type === 'predator') {
                images['predator'].draw(cx, cy, critter.direction === 'right')
            }
        }
    })

    window.requestAnimationFrame(update)
}

let takeTurn = () => {
    turnsSinceLastPredator++
    if (turnsSinceLastPredator > turnsBetweenPredators && critters.length - numPrey < numPredators) {
        turnsSinceLastPredator = 0
        critters.push(makeCritter('predator'))
    }

    critters.forEach(critter => {
        critter.turnTimer--
        if (critter.turnTimer < 0) {
            critter.turnTimer = 0
        } else {
            return
        }

        let newX = critter.x
        let newY = critter.y
        let blocked = false
        let pushed = false

        let dx = avatarX - newX
        let dy = avatarY - newY

        if (critter.blockedTurns > 4 && (critter.type === 'prey' || critter.type === 'predator')) {
            let direction = Math.random() * 4
            if (direction < 1) newX++
            else if (direction < 2) newX--
            else if (direction < 3) newY++
            else if (direction < 4) newY--
        }
        else if (critter.type === 'prey') {
            // avoid avatar
            if (dx * dx + dy * dy < 3 * 3) {
                pushed = true
                let angle = Math.atan2(dy, dx) * 180 / Math.PI + 180
                if (angle > 45 && angle <= 135) newY++
                else if (angle > 135 && angle <= 225) newX--
                else if (angle > 225 && angle <= 315) newY--
                else newX++
            }
            // wander around
            else {
                let direction = Math.random() * 5
                if (direction < 1) newX++
                else if (direction < 2) newX--
                else if (direction < 3) newY++
                else if (direction < 4) newY--
            }
        }
        else if (critter.type === 'predator') {
            // track prey
            let foundPrey = false

            critters.forEach(otherCritter => {
                if (foundPrey || otherCritter.type !== 'prey') return

                let distToPreyX = otherCritter.x - newX
                let distToPreyY = otherCritter.y - newY

                if (distToPreyX * distToPreyX + distToPreyY * distToPreyY < 6 * 6) {
                    let angle = Math.atan2(distToPreyY, distToPreyX) * 180 / Math.PI + 180
                    if (angle > 45 && angle <= 135) newY--
                    else if (angle > 135 && angle <= 225) newX++
                    else if (angle > 225 && angle <= 315) newY++
                    else newX--

                    foundPrey = true
                }
            })
            // track avatar if no prey
            if (!foundPrey && dx * dx + dy * dy < 8 * 8) {
                let angle = Math.atan2(dy, dx) * 180 / Math.PI + 180
                if (angle > 45 && angle <= 135) newY--
                else if (angle > 135 && angle <= 225) newX++
                else if (angle > 225 && angle <= 315) newY++
                else newX--
            }
        }

        if (critter.type === 'prey') critter.turnTimer = 0
        else if (critter.type === 'predator') critter.turnTimer = 1

        // set direction of critter
        if (newX > critter.x) critter.direction = 'right'
        if (newX < critter.x) critter.direction = 'left'

        // check collision with avatar
        if (newX === avatarX && newY === avatarY) {
            blocked = true
            if (critter.type === 'predator') {
                endGame()
            }
        }

        // check collisions with other critters
        critters.forEach(otherCritter => {
            if (newX === otherCritter.x && newY === otherCritter.y && otherCritter.type !== 'in-portal') {
                blocked = true
                if (critter.type === 'predator' && otherCritter.type === 'prey') {
                    otherCritter.type = 'dead'
                    if (critters.filter(c => c.type === 'prey').length === 0) {
                        endGame()
                    }
                }
            }
        })

        // check collisions with terrain
        trees.forEach(tree => {
            if (newX === tree.x && newY === tree.y) {
                blocked = true
            }
        })
        rocks.forEach(rock => {
            if (newX === rock.x && newY === rock.y) {
                blocked = true
            }
        })

        // check collisions with portals
        portals.forEach(portal => {
            if (newX === portal.x && newY === portal.y) {
                if (pushed) {
                    critter.type = 'in-portal'
                    if (critters.filter(c => c.type === 'prey').length === 0) {
                        endGame()
                    }
                } else {
                    blocked = true
                }
            }
        })

        // check edges
        if (newX < 0 || newX >= mapWidth) blocked = true
        if (newY < 0 || newY >= mapHeight) blocked = true

        // move if not blocked
        if (!blocked) {
            critter.x = newX
            critter.y = newY
            critter.blockedTurns = 0
        } else {
            critter.blockedTurns++
        }

    })
}

let startGame = () => {
    gameState = 'start'

    offsetX = Math.floor((mapWidth / 2) - (screenWidth / 2)) + 1
    offsetY = Math.floor((mapHeight / 2) - (screenHeight / 2)) + 1
    
    avatarX = Math.floor((mapWidth / 2))
    avatarY = Math.floor((mapHeight / 2))
    
    critters = []
    greebles = []
    trees = []
    rocks = []
    portals = []

    turnsSinceLastPredator = 0
    lastTimestamp = null
    lastAnimationFrame = null
    animationStep = 0
    lastKey = null

    // init map
    generateMap()

    // init critters
    for (let i = 0; i < numPrey; i++) {
        critters.push(makeCritter('prey'))
    }
}

let endGame = () => {
    lastKey = null
    animationStep = 0
    gameState = 'end'
}

let createSprite = (spriteX, spriteY) => {
    let spriteLeftCanvas = document.createElement('canvas')
    let spriteLeftContext = spriteLeftCanvas.getContext('2d')
    spriteLeftContext.drawImage(
        spritesheet,
        spriteX * tileWidth, spriteY * tileHeight, tileWidth, tileHeight,
        0, 0, tileWidth, tileHeight
    )
    
    let spriteRightCanvas = document.createElement('canvas')
    let spriteRightContext = spriteRightCanvas.getContext('2d')
    spriteRightContext.translate(canvas.width, 0)
    spriteRightContext.scale(-1, 1)
    spriteRightContext.drawImage(
        spritesheet,
        spriteX * tileWidth, spriteY * tileHeight, tileWidth, tileHeight,
        canvas.width - tileWidth, 0, tileWidth, tileHeight
    )

    return {
        draw: (x, y, flipped, precise) => {
            x = precise ? x : x * tileWidth
            y = precise ? y : y * tileHeight
            if (flipped) {
                context.drawImage(spriteRightCanvas, x, y)
            } else {
                context.drawImage(spriteLeftCanvas, x, y)
            }
        }
    }
}

window.onload = () => {
    let main = document.getElementById('main')
    canvas = document.createElement('canvas')
    canvas.width = screenWidth * tileWidth
    canvas.height = screenHeight * tileHeight
    context = canvas.getContext('2d')
    main.appendChild(canvas)

    titleImage = document.getElementById('title')

    spritesheet = document.getElementById('spritesheet')
    images = {
        'avatar': createSprite(0, 0),
        'predator': createSprite(0, 1),
        'prey': createSprite(1, 1),
        'prey-dead': createSprite(2, 1),
        'tree': createSprite(0, 2),
        'rock': createSprite(1, 2),
        'greeble': createSprite(2, 2),
        'greeble-portal': createSprite(2, 0),
        'portal-0': createSprite(0, 3),
        'portal-1': createSprite(1, 3),
        'portal-2': createSprite(2, 3),
        'portal-3': createSprite(0, 4),
        'portal-4': createSprite(1, 4),
        'portal-5': createSprite(2, 4),
        'portal-6': createSprite(0, 5),
        'portal-7': createSprite(1, 5),
        'portal-8': createSprite(2, 5),
    }

    document.addEventListener('keydown', e => {
        if (!e.key.includes('Arrow') && e.key !== 'w' && e.key !== 'a' && e.key !== 's' && e.key !== 'd') return
        e.preventDefault()
        lastKey = e.key
    })

    document.addEventListener('keyup', e => {
        if (!e.key.includes('Arrow') && e.key !== 'w' && e.key !== 'a' && e.key !== 's' && e.key !== 'd') return
        keyDebounce = 0
    })

    startGame()
    
    window.requestAnimationFrame(update)
}