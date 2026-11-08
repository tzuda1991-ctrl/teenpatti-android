package com.teenpatti.demo

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.random.Random

class MainActivity : Activity() {
    private var chips = 1000
    private lateinit var balance: TextView
    private lateinit var cards: TextView
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) chips = savedInstanceState.getInt("chips", 1000)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setBackgroundColor(Color.rgb(12, 55, 46))
        }
        fun label(text: String, size: Float): TextView = TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(8, 16, 8, 16)
        }
        root.addView(label("TEEN PATTI", 32f).apply { setTypeface(null, Typeface.BOLD) })
        root.addView(label("Practice mode • No real money", 16f))
        balance = label("", 24f)
        cards = label("Tap Deal to start", 26f)
        status = label("Virtual chips only", 18f)
        root.addView(balance)
        root.addView(cards)
        root.addView(status)
        val deal = Button(this).apply {
            text = "DEAL 3 CARDS (10 CHIPS)"
            setOnClickListener {
                if (chips < 10) {
                    status.text = "Not enough chips. Reset to continue."
                } else {
                    chips -= 10
                    val deck = (0 until 52).shuffled().take(3)
                    val ranks = listOf("A","2","3","4","5","6","7","8","9","10","J","Q","K")
                    val suits = listOf("♠","♥","♦","♣")
                    cards.text = deck.joinToString("   ") { "${ranks[it % 13]}${suits[it / 13]}" }
                    status.text = "Practice hand dealt. Multiplayer coming later."
                    updateBalance()
                }
            }
        }
        root.addView(deal)
        root.addView(Button(this).apply {
            text = "RESET PRACTICE CHIPS"
            setOnClickListener {
                chips = 1000
                cards.text = "Tap Deal to start"
                status.text = "Practice chips reset"
                updateBalance()
            }
        })
        updateBalance()
        setContentView(root)
    }

    private fun updateBalance() { balance.text = "Chips: $chips" }
    override fun onSaveInstanceState(outState: Bundle) {
        outState.putInt("chips", chips)
        super.onSaveInstanceState(outState)
    }
}
