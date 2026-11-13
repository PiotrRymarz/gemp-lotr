package com.gempukku.lotro.logic;

import com.gempukku.lotro.game.PhysicalCard;
import com.gempukku.lotro.game.state.LotroGame;
import com.gempukku.lotro.logic.timing.Action;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Where one game's random draws come from (shuffles, random cards from a hand, the seating order).
 * <p>
 * Normally this is {@link ThreadLocalRandom}, as before. When the JVM is started with
 * {@code -Dgemp.game.randomSeed=<number>}, every game gets its own {@link Random} with that seed, so the same moves give
 * the same game. Only test servers set it (the game screen's visual check plays the same game on two pages).
 */
public final class GameRandom {
    public static final String SEED_PROPERTY = "gemp.game.randomSeed";

    private final Random _seeded;

    public GameRandom() {
        this(Long.getLong(SEED_PROPERTY));
    }

    public GameRandom(Long seed) {
        _seeded = seed == null ? null : new Random(seed);
    }

    /**
     * True when the JVM was started with a seed: then whatever else would make two games differ, such as the order of
     * a table's players, is fixed too.
     */
    public static boolean isSeeded() {
        return Long.getLong(SEED_PROPERTY) != null;
    }

    /**
     * The cards of a decision in the order it lists them. A list keeps its order; a set's order follows object hashes,
     * so on a seeded server it is put in card id order instead (elsewhere it stays as it was).
     */
    public static <T extends PhysicalCard> List<T> stableOrder(Collection<T> cards) {
        List<T> result = new LinkedList<>(cards);
        if (isSeeded() && !(cards instanceof List))
            result.sort(Comparator.comparingInt(PhysicalCard::getCardId));
        return result;
    }

    /**
     * The actions of a decision in the order it lists them: as given, or on a seeded server by their card's id and then
     * their text, since the given order can follow object hashes (e.g. several required responses at once).
     */
    public static <T extends Action> List<T> stableActionOrder(LotroGame game, List<T> actions) {
        if (!isSeeded())
            return actions;
        List<T> result = new ArrayList<>(actions);
        result.sort(Comparator
                .comparingInt((T action) -> action.getActionAttachedToCard() != null ? action.getActionAttachedToCard().getCardId() : -1)
                .thenComparing(action -> String.valueOf(action.getText(game))));
        return result;
    }

    /** The random source to draw from now; ask again for each draw, as {@link ThreadLocalRandom} is per thread. */
    public Random get() {
        return _seeded != null ? _seeded : ThreadLocalRandom.current();
    }
}
